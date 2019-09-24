[![nodejs version status](https://img.shields.io/badge/NodeJS-8.x.x-green.svg?style=flat-square)]()

# moleculer-schema-adapter (MSA)

<p align="justify">An adapter that allows events and actions parameters to be validated against JSON schemas.</p>

## Table of Contents

  1. [Requirements](#requirements)
  2. [Usage](#usage)
  3. [Distribution](#distribution)

## Requirements

MSA assumes that you are using the Moleculer microservice framework.

## How it works

When `MSA` loads, it reads the schema directory, validating and caching all schemas. Subsequently, `MSA` chooses the schema to use based on the name of the event or action.

## Usage

- Require the package;
- Add the middleware to the service configuration;
- Add the mixin to the service;

## Distribution

- Via [NPM](https://www.npmjs.com/package/@wrecking-ball-software/moleculer-schema-adapter)
