import * as path from 'path'
import * as fs from 'fs'
import * as stream from 'stream/promises'
import * as crypto from 'crypto'
import * as core from '@actions/core'
import * as io from '@actions/io'
import * as tc from '@actions/tool-cache'
import * as exec from '@actions/exec'

import type * as octokit from '@octokit/core'
import type * as graphql from '@octokit/graphql-schema'
import type * as http from '@actions/http-client'

export default class Action {
	public readonly version: string
	public readonly platform: string
	public readonly arch: string

	private readonly octokit: octokit.Octokit
	private readonly httpClient: http.HttpClient

	constructor(version: string, platform: string, arch: string, octokit: octokit.Octokit, httpClient: http.HttpClient) {
		this.version = version
		this.platform = platform
		this.arch = arch

		this.octokit = octokit
		this.httpClient = httpClient
	}

	private archive(): string {
		let version = this.version
		let platform = this.platform
		let arch = this.arch
		let ext = 'tar.gz'

		switch (arch) {
			case 'x64':
				arch = 'amd64'
				break
			case 'arm64':
				break
			case 'arm':
				arch = 'armv7'
				break
			default:
				throw new Error('unsupported architecture')
		}

		switch (platform) {
			case 'linux':
				break
			case 'darwin':
				if (arch = 'armv7') throw new Error('unsupported platform and architecture combination')
				break
			case 'win32':
				platform = 'windows'
				ext = 'zip'
			default:
				throw new Error('unsupported platform')
		}

		return `dagger_${version}_${platform}_${arch}.${ext}`
	}

	private async url(asset: string): Promise<string> {
		const result = await this.octokit.graphql<{ repository: graphql.Repository }>(
			`query ($owner: String!, $repo: String!, $release: String!, $asset: String!) {
				repository(owner: $owner, name: $repo) {
					release(tagName: $release) {
						releaseAssets(name: $asset, first: 1){
							nodes{
								downloadUrl
							}
						}
					}
				}
			}`,
			{
				owner: 'dagger',
				repo: 'dagger',
				release: this.version,
				asset: asset
			}
		)

		const release = result.repository.release

		if (release === undefined || release === null) {
			throw new Error('release not found')
		}

		const assets = release.releaseAssets.nodes

		if (assets === undefined || assets === null || assets.length === 0) {
			throw new Error('asset not found')
		}

		return assets[0]?.downloadUrl
	}

	public async installCli(): Promise<void> {
		let cachedPath = tc.find('dagger', this.version)

		if (cachedPath === '') {
			const archive = this.archive()

			let downloadPath: string

			try {
				const url = await this.url(archive)

				downloadPath = await tc.downloadTool(url)
			} catch (error: any) {
				throw new Error('failed to download archive: ' + error.message)
			}

			try {
				const url = await this.url('checksums.txt')

				const response = await this.httpClient.get(url)

				const checksum = (await response.readBody()).split('\n').find((checksum: string): boolean => {
					return checksum.includes(archive)
				})

				if (checksum === undefined) {
					throw new Error('checksum not found')
				}

				const hash = crypto.createHash('sha256')

				await stream.pipeline(fs.createReadStream(downloadPath), hash)

				if (!checksum.startsWith(hash.digest('hex'))) {
					throw new Error('checksum mismatch')
				}
			} catch (error: any) {
				throw new Error('failed to verify archive checksum: ' + error.message)
			}

			let extractPath: string

			try {
				if (archive.endsWith('zip')) {
					extractPath = await tc.extractZip(downloadPath)
				}
				else {
					extractPath = await tc.extractTar(downloadPath)
				}
			}
			catch (error: any) {
				throw new Error('failed to extract archive: ' + error.message)
			}

			cachedPath = await tc.cacheFile(path.join(extractPath, 'dagger'), 'dagger', 'dagger', this.version).catch((error) => {
				throw new Error('failed to cache binary: ' + error.message)
			})

			await io.rmRF(downloadPath).catch((error) => {
				throw new Error('failed to remove downloaded archive: ' + error.message)
			})

			await io.rmRF(extractPath).catch((error) => {
				throw new Error('failed to remove extracted archive: ' + error.message)
			})
		}

		core.addPath(cachedPath)
	}

	public async startEngine(): Promise<void> {
		const command = 'docker run ' +
			'--name dagger-engine ' +
			'--privileged ' +
			'--volume dagger-engine:/var/lib/dagger ' +
			'--stop-signal SIGTERM ' +
			'--detach'

		const args = [
			`registry.dagger.io/engine:${this.version}`,
		]

		await exec.exec(command, args)

		core.exportVariable('EXPERIMENTAL_DAGGER_RUNNER_HOST', 'docker-container://dagger-engine')
	}

	public static async stopEngine(): Promise<void> {
		await exec.exec('docker stop --time 60 dagger-engine')

		if (core.isDebug()) {
			await exec.exec('docker logs dagger-engine')
		}

		await exec.exec('docker rm dagger-engine')
	}
}
