import * as core from '@actions/core'

import Action from './action'

await async function (): Promise<void> {
	try {
		await Action.stopEngine().catch((error) => {
			throw new Error('failed to stop engine: ' + error.message)
		})
	} catch (error: any) {
		core.setFailed(error.message)
	}
}()
