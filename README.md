# GitHub action to setup Dagger

[![GitHub Super-Linter](https://github.com/actions/javascript-action/actions/workflows/linter.yml/badge.svg)](https://github.com/super-linter/super-linter)
![CI](https://github.com/actions/javascript-action/actions/workflows/ci.yml/badge.svg)

This GitHub action sets up (https://dagger.io)[Dagger]: it installs Dagger CLI and starts Dagger Engine.

## Usage

```yaml
steps:
  - name: 'Checkout repository'
    id: 'checkout'
    uses: 'actions/checkout@v4'

  - name: 'Set up Dagger'
    id: 'dagger-setup'
    uses: 'camptocamp/setup-dagger'
    with:
      cloud-token: '{{ $secrets.DAGGER_CLOUD_TOKEN }}'

  - name: 'Run Dagger'
    id: 'dagger'
    run: |
      dagger call --mod 'github.com/camptocamp/setup-dagger' test
```
