"use strict";

const requireDir = require("require-dir");
const path = require("path");
const Ajv = require("ajv");
const ajv = Ajv({
	allErrors: true
});

const CNE = require("./errors");

/**
 * Process(validate, and cache) a schema.
 *
 * @param {Object} ctx context
 * @param {string} schemaName schema name
 * @param {string} schema valid JSON schema
 *
 * @throws {SCHEMA_INVALID}
 */
const processSchema = (ctx, schemaName, schema) => {
	if (!ajv.validateSchema(schema)) throw new CNE.SCHEMA_INVALID(ajv.errors, null);

	// AJV: It isn't possible to manually cache schemas (in-memory), as such
	// functionality isn't exposed via the API, but calling `compile` will
	// create the cache.
	//
	// Note that `compile` also performs validation, but if the schema is
	// invalid, AJV will automatically throw errors. I purposely split the
	// process into two steps, to gain more fine-grained controls.
	ajv.compile(schema);

	// Cache schema
	if (ctx && Object.keys(ctx).includes("broker")) {
		ctx.logger.info(`Cached ${schemaName}`);

		// Cache in-memory
		ctx.settings.schemas[schemaName] = schema;

		// Only cache if it's set
		if (
			Object.keys(ctx.broker).includes("cacher") &&
			ctx.broker.cacher
		) ctx.broker.cacher.set(schemaName, schema);
	}

	return schema;
};

/**
 * Load all schemas from a given directory.
 *
 * @param {Object} ctx context
 * @param {string} schemasDirectory path to the schemas directory
 *
 * @throws {PATH_FAILED_READ_DIRECTORY}
 * @throws {PATH_FAILED_TO_PROCESS_SCHEMA}
 */
const loadAllSchemasFromDisk = (ctx, schemasDirectory) => {
	let schemasMap;

	const resolvedDirectoryPath = path.resolve(schemasDirectory);

	// Load schemas
	try {
		schemasMap = new Map(
			Object.entries(
				requireDir(resolvedDirectoryPath, {
					extensions: [".ts", ".js"]
				})
			)
		);
	} catch (error) {
		throw new CNE.PATH_FAILED_READ_DIRECTORY(resolvedDirectoryPath, error);
	}

	// Process each schema: validate, and cache
	schemasMap.forEach((schema, schemaName) => {
		try {
			processSchema(ctx, schemaName, schema);
		} catch (error) {
			throw new CNE.PATH_FAILED_TO_PROCESS_SCHEMA(schemaName, error);
		}
	});
};

module.exports = {
	loadAllSchemasFromDisk
};
