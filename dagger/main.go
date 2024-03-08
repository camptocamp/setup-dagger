// Copyright Camptocamp SA
// SPDX-License-Identifier: AGPL-3.0-or-later

package main

type SetupDagger struct{}

func (m *SetupDagger) Test() *Container {
	return dag.Container().From("alpine:latest").WithExec([]string{"echo", "It works!"})
}
