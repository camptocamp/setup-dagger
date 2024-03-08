// Copyright Camptocamp SA
// SPDX-License-Identifier: AGPL-3.0-or-later

import * as path from 'path'
import * as fs from 'fs'
import * as stream from 'stream/promises'
import * as crypto from 'crypto'
import * as core from '@actions/core'
import * as io from '@actions/io'
import * as tc from '@actions/tool-cache'
import * as exec from '@actions/exec'
import { HttpClient } from '@actions/http-client'

export default class Action {
  public readonly version: string
  public readonly platform: string
  public readonly arch: string

  private readonly httpClient: HttpClient

  constructor (version: string, platform: string, arch: string) {
    this.version = version
    this.platform = platform
    this.arch = arch

    this.httpClient = new HttpClient()
  }

  private archive (): string {
    let platform = this.platform
    let arch = this.arch
    let ext = 'tar.gz'

    switch (platform) {
      case 'linux':
      case 'darwin':
        break
      case 'win32':
        platform = 'windows'
        ext = 'zip'
        break
      default:
        throw new Error('Unsupported platform')
    }

    switch (arch) {
      case 'x64':
        arch = 'amd64'
        break
      case 'arm64':
        break
      case 'arm':
        arch = 'armv7'
        if (platform === 'darwin') throw new Error('Unsupported platform and architecture combination')
        break
      default:
        throw new Error('Unsupported architecture')
    }

    return `dagger_${this.version}_${platform}_${arch}.${ext}`
  }

  private url (asset: string): string {
    return `https://github.com/dagger/dagger/releases/download/${this.version}/${asset}`
  }

  public async installCli (): Promise<void> {
    let cachedPath = tc.find('dagger', this.version)

    if (cachedPath === '') {
      const archive = this.archive()

      const downloadPath = await tc.downloadTool(this.url(archive)).catch((error) => {
        throw new Error('Failed to download archive', { cause: error })
      })

      try {
        const httpResponse = await this.httpClient.get(this.url('checksums.txt')).catch((error) => {
          throw new Error('Failed to download checksums', { cause: error })
        })

        const httpResponseBody = await httpResponse.readBody().catch((error) => {
          throw new Error('Failed to read checksums', { cause: error })
        })

        const checksum = httpResponseBody.split('\n').find((checksum: string): boolean => {
          return checksum.includes(archive)
        })

        if (checksum === undefined) {
          throw new Error('Checksum not found')
        }

        const hash = crypto.createHash('sha256')

        await stream.pipeline(fs.createReadStream(downloadPath), hash)

        if (!checksum.startsWith(hash.digest('hex'))) {
          throw new Error('Checksum mismatch')
        }
      } catch (error) {
        throw new Error('Failed to verify archive checksum', { cause: error })
      }

      let extractPath: string

      try {
        if (archive.endsWith('zip')) {
          extractPath = await tc.extractZip(downloadPath)
        } else {
          extractPath = await tc.extractTar(downloadPath)
        }
      } catch (error: any) {
        throw new Error('Failed to extract archive', { cause: error })
      }

      cachedPath = await tc.cacheFile(path.join(extractPath, 'dagger'), 'dagger', 'dagger', this.version).catch((error) => {
        throw new Error('Failed to cache binary', { cause: error })
      })

      await io.rmRF(downloadPath).catch((error) => {
        throw new Error('Failed to remove downloaded archive', { cause: error })
      })

      await io.rmRF(extractPath).catch((error) => {
        throw new Error('Failed to remove extracted archive', { cause: error })
      })
    }

    core.addPath(cachedPath)
  }

  public async startEngine (): Promise<void> {
    const command = 'docker run ' +
      '--name dagger-engine ' +
      '--privileged ' +
      '--volume dagger-engine:/var/lib/dagger ' +
      '--stop-signal SIGTERM ' +
      '--detach'

    const args = [
      `registry.dagger.io/engine:${this.version}`
    ]

    await exec.exec(command, args)

    core.exportVariable('EXPERIMENTAL_DAGGER_RUNNER_HOST', 'docker-container://dagger-engine')
  }

  public static async stopEngine (): Promise<void> {
    await exec.exec('docker stop --time 60 dagger-engine')

    if (core.isDebug()) {
      await exec.exec('docker logs dagger-engine')
    }

    await exec.exec('docker rm dagger-engine')
  }
}
