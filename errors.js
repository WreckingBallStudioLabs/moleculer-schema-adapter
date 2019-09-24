//////
// Custome typed and named errors
//////

"use strict";

const {
	MoleculerError
} = require("moleculer").Errors;

const PATH_FAILED_READ_DIRECTORY = class PATH_FAILED_READ_DIRECTORY extends MoleculerError {
	constructor(pathDirectory, error) {
		const msg = `Failed to read content of directory: ${pathDirectory}`;
		console.error(`${msg} Error:`, error);
		super(msg, 500, "PATH_FAILED_READ_DIRECTORY", error);
	}
};

const PATH_FAILED_TO_PROCESS_SCHEMA = class PATH_FAILED_TO_PROCESS_SCHEMA extends MoleculerError {
	constructor(schemaName, error) {
		const msg = `Failed to process schema "${schemaName}"`;
		console.error(`${msg} Error:`, error);
		super(msg, 500, "PATH_FAILED_TO_PROCESS_SCHEMA", error);
	}
};

const SCHEMA_INVALID = class SCHEMA_INVALID extends MoleculerError {
	constructor(error) {
		const msg = "Invalid schema.";
		console.error(`${msg} Error:`, error);
		super(msg, 500, "SCHEMA_INVALID", error);
	}
};

const INVALID_PAYLOAD = class INVALID_PAYLOAD extends MoleculerError {
	constructor(schemaName, error) {
		const msg = `Invalid payload. Using "${schemaName}" schema.`;
		console.error(`${msg} Error:`, error);
		super(msg, 500, "INVALID_PAYLOAD", error);
	}
};

const MISSING_SCHEMA = class MISSING_SCHEMA extends MoleculerError {
	constructor(action) {
		super(`Missing ${action} schema! Was that loaded?`);
	}
};

module.exports = {
	PATH_FAILED_READ_DIRECTORY,
	PATH_FAILED_TO_PROCESS_SCHEMA,
	SCHEMA_INVALID,
	INVALID_PAYLOAD,
	MISSING_SCHEMA
};
