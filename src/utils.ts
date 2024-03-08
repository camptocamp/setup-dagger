// Copyright Camptocamp SA
// SPDX-License-Identifier: AGPL-3.0-or-later

export default function logError (error: any): void {
  const print = (error: any, prefix: string): void => {
    console.log(prefix + (error.toString() as string))

    if (error.cause !== undefined) {
      print(error.cause, prefix === '' ? '└─' : '  ' + prefix)
    }
  }

  print(error, '')
}
