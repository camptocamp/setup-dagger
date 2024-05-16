# GitHub Action to set up Dagger

![Tests](https://github.com/camptocamp/setup-dagger/actions/workflows/tests.yaml/badge.svg?branch=main)

This GitHub Action sets up [Dagger](https://dagger.io): it installs Dagger CLI and starts Dagger Engine.

## Usage

```yaml
steps:
  - name: "Check out repository"
    id: "checkout"
    uses: "actions/checkout@v4"

  - name: "Set up Dagger"
    id: "setup-dagger"
    uses: "camptocamp/setup-dagger@v1"
    with:
      cloud-token: "{{ $secrets.DAGGER_CLOUD_TOKEN }}"

  - name: "Run Dagger"
    id: "run-dagger"
    run: |
      dagger version
```
