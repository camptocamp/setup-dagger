// Copyright Camptocamp SA
// SPDX-License-Identifier: AGPL-3.0-or-later

import * as core from '@actions/core'

import Action from './action'
import printError from './utils'

await (async function (): Promise<void> {
  await Action.stopEngine().catch((error) => {
    throw new Error('Failed to stop engine', { cause: error })
  })
}()).catch((error) => {
  printError(error)
  core.setFailed(error)
})
