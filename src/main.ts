// Copyright Camptocamp SA
// SPDX-License-Identifier: AGPL-3.0-or-later

import * as process from 'process'
import * as fs from 'fs/promises'
import * as core from '@actions/core'

import Action from './action'
import printError from './utils'

await (async function (): Promise<void> {
  const module = JSON.parse((await fs.readFile('dagger.json').catch((error) => {
    throw new Error('Failed to parse dagger.json file', { cause: error })
  })).toString())

  const action = new Action(module.engineVersion, process.platform, process.arch)

  await Promise.all([
    action.installCli().catch((error) => {
      throw new Error('Failed to install CLI', { cause: error })
    }),
    action.startEngine().catch((error) => {
      throw new Error('Failed to start engine', { cause: error })
    })
  ])

  const cloudToken = core.getInput('cloud-token')

  if (cloudToken !== '') {
    core.exportVariable('DAGGER_CLOUD_TOKEN', cloudToken)
  }
}()).catch((error) => {
  printError(error)
  core.setFailed(error)
})
