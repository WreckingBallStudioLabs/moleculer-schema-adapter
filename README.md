[![nodejs version status](https://img.shields.io/badge/NodeJS-8.x.x-green.svg?style=flat-square)]()

# moleculer-schema-adapter (MSA)

<p align="justify">An adapter that connects to a Schema service, allowing you to verify and validate communication between services.</p>

## Table of Contents

  1. [Requirements](#requirements)
  2. [Usage](#usage)
  3. [Distribution](#distribution)

## Requirements

MSA assumes that you are using the Moleculer microservice framework, and have a moleculer Schema service. This service should provide valid JSON Schemas via an action (default name: `fetch`), by `id` where `id` should be the name of the schema. MSA is flexible, allowing the developer to set:

- Name of the Schema service, default lookup: `schema`
- Name of the action, default lookup: `fetch`
- Wait time (dependency timeout), default value: `10000` (in ms)

## Usage

- Require the package
- Add the middleware to the service configuration
- Add the mixin to the service


## Distribution

- Via [NPM](https://www.npmjs.com/package/@wrecking-ball-software/moleculer-schema-adapter)
