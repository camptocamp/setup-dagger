package main

type SetupDagger struct{}

func (m *SetupDagger) Test() *Container {
	return dag.Container().From("alpine:latest").WithExec([]string{"echo", "It works!"})
}
