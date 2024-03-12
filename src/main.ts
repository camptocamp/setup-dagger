import * as process from 'process'
import * as fs from 'fs/promises'
import * as core from '@actions/core'
import * as github from '@actions/github'
import { HttpClient } from '@actions/http-client'

import Action from './action'

await async function (): Promise<void> {
  try {
    const githubToken = process.env['GITHUB_TOKEN']

    if (githubToken === undefined) {
      throw new Error('failed to get GITHUB_TOKEN environment variable')
    }

    const octokit = github.getOctokit(githubToken)
    const httpClient = new HttpClient()

    const module = JSON.parse((await fs.readFile('dagger.json').catch((error) => {
      throw new Error('failed to read dagger.json file: ' + error.message)
    })).toString())

    const action = new Action(module.engineVersion, process.platform, process.arch, octokit, httpClient)

    await Promise.all([
      action.installCli().catch((error) => {
        throw new Error('failed to install CLI: ' + error.message)
      }),
      action.startEngine().catch((error) => {
        throw new Error('failed to start engine: ' + error.message)
      }),
    ])

    const cloudToken = core.getInput('cloud-token')

    if (cloudToken !== '') {
      core.exportVariable('DAGGER_CLOUD_TOKEN', cloudToken)
    }
  } catch (error: any) {
    core.setFailed(error.message)
  }
}()
