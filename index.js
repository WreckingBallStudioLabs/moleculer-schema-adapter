/**
 * The intention of this package is to provide schema validation for incoming
 * requests for both actions and events. It allows each service to act as a
 * decentralized schema validation authority.
 *
 * These incoming requests are automatically validated if a matching schema
 * exists. To enable it, the returned middleware must be added to the broker
 * middlewares array and the mixin to the mixin array.
 */

const Ajv = require("ajv");
const ajv = Ajv({
	allErrors: true
});
const path = require("path");
const fs = require("fs");
const {
	ValidationError,
	MoleculerError
} = require("moleculer").Errors;

//////
// Custome Names Errors
//////

const PATH_DIRECTORY_DOES_NOT_EXIST = class PATH_DIRECTORY_DOES_NOT_EXIST extends MoleculerError {
	constructor(pathDirectory, error) {
		super(
			`Directory doesn't exists: ${pathDirectory}`,
			500,
			"PATH_DIRECTORY_DOES_NOT_EXIST",
			error
		);
	}
};
const PATH_FILE_DOES_NOT_EXIST = class PATH_FILE_DOES_NOT_EXIST extends MoleculerError {
	constructor(pathFile, error) {
		super(
			`File doesn't exists: ${pathFile}`,
			500,
			"PATH_FILE_DOES_NOT_EXIST",
			error
		);
	}
};
const PATH_FAILED_READ_DIRECTORY = class PATH_FAILED_READ_DIRECTORY extends MoleculerError {
	constructor(pathDirectory, error) {
		super(
			`Failed to read content of directory: ${pathDirectory}`,
			500,
			"PATH_FAILED_READ_DIRECTORY",
			error
		);
	}
};
const SCHEMA_INVALID = class SCHEMA_INVALID extends MoleculerError {
	constructor(error) {
		super("Invalid schema", 500, "SCHEMA_INVALID", error);
	}
};

const MISSING_SCHEMA = class MISSING_SCHEMA extends MoleculerError {
	constructor(action) {
		super(`${action} requires a schema to validate the payload. Request has been refused.`);
	}
};

const MISSING_SCHEMA_DIR_ENV_VAR = class MISSING_SCHEMA_DIR_ENV_VAR extends MoleculerError {
	constructor() {
		super("Is SCHEMA_DIR defined?");
	}
};

//////
// Convenience functions
// @see https://softwareengineering.stackexchange.com/a/272812
//////

/**
 * Load the specified schema from the FS.
 *
 * @param {Object} ctx context
 * @param {string} schemasDirectory schemas directory
 * @param {string} schemaName schema name
 *
 * @throws {PATH_DIRECTORY_DOES_NOT_EXIST}
 * @throws {PATH_FILE_DOES_NOT_EXIST}
 * @throws {SCHEMA_INVALID}
 *
 * @returns {Object} schema
 */
const loadSchemaFromDisk = (ctx, schemasDirectory, schemaName) => {
	// Build, normalize (Windows/*nix compatible), and resolve the path to the
	// schema directory
	const schemaPath = `${schemasDirectory}/${schemaName}.js`;
	const normalizedSchemaPath = path.normalize(schemaPath);
	const resolvedSchemaPath = path.resolve(normalizedSchemaPath);

	// Safe guards:
	// - Validate directory
	// - Validate file
	if (!fs.existsSync(normalizedSchemaPath))
		throw new PATH_DIRECTORY_DOES_NOT_EXIST(schemasDirectory, null);
	if (!fs.existsSync(resolvedSchemaPath))
		throw new PATH_FILE_DOES_NOT_EXIST(schemasDirectory, null);

	// Safe guard:
	// - Validate schema
	//
	// Load schema from FS, and validate
	const schema = require(resolvedSchemaPath);
	const isValid = ajv.validateSchema(schema);

	if (!isValid) throw new SCHEMA_INVALID(ajv.errors, null);

	// AJV: It isn't possible to manually cache schemas (in-memory), as such
	// functionality isn't exposed via the API, but calling `compile` will
	// create the cache.
	//
	// Note that `compile` also performs validation, but if the schema is
	// invalid, AJV will automatically throw errors. I purposely split the
	// process into two steps, to gain more fine-grained controls.
	ajv.compile(schema);

	// Cache at service level, via Moleculer Broker Cacher (redis)
	if (ctx && Object.keys(ctx).includes("broker")) {
		ctx.logger.info(`Cached ${schemaName}`);
		ctx.broker.cacher.set(schemaName, schema);
		ctx.settings.schemas[schemaName] = schema;
	}

	return schema;
};

/**
 * Load all schemas in a given directory
 *
 * @param {Object} ctx context
 * @param {string} schemasDirectory schemas directory
 *
 * @throws {PATH_FAILED_READ_DIRECTORY}
 *
 * @returns {Array<Object>} schemas
 */
const loadAllSchemasFromDisk = (ctx, schemasDirectory) => {
	// Build path
	const normalizedDirectoryPath = path.normalize(schemasDirectory);
	const resolvedDirectoryPath = path.resolve(normalizedDirectoryPath);
	const schemas = [];

	try {
		const listOfFilenames = fs.readdirSync(resolvedDirectoryPath);
		const setOfFilenamesWithoutExtension = new Set();

		listOfFilenames.forEach(filename => {
			setOfFilenamesWithoutExtension.add(
				filename.substring(0, filename.indexOf(".js"))
			);
		});

		// Deduplication by using `Set`
		// @see scripts/benchmark-loadAllSchemasFromDisk.js
		setOfFilenamesWithoutExtension.forEach(entry => {
			schemas.push(loadSchemaFromDisk(ctx, schemasDirectory, entry));
		});
	} catch (error) {
		throw new PATH_FAILED_READ_DIRECTORY(resolvedDirectoryPath, error);
	}

	return schemas;
};

//////
// Starts here
//////

/**
 * Moleculer Schema Adaptor factory
 *
 * @param {string} [schemaServiceName=schema] Moleculer Schema service name
 * @param {string} [actionName=fetch] Action to call
 * @param {Object} [settings]
 */
const MoleculerSchemaAdaptor = settings => {
	// TODO: Settings can be used later to wire in a notification type service
	if (!settings) settings = {};
	Object.assign(settings, {});

	return {
		middleware: {
			// Listen to all incoming events
			localEvent(next, broker) {
				return (payload, sender, topic) => {
					// Call method
					broker.service
						.validateEvent(payload, sender, topic)
						// Validation succeed :)
						.then(() => {})
						// Validation failed :(
						.catch(error => {
							this.logger.error(
								"middleware::localEvent::return::validateEvent::invalid",
								error
							);

							// TODO: Also handle rejection by calling the Notification Service
						});

					return next(payload, sender, topic);
				};
			}
		},

		// The Moleculer Service constructor merges these mixins with the current schema.
		// When a service uses mixins, all properties in the mixin will be “mixed”, merged,
		// into the current service.
		mixin: {
			// The Moleculer Service constructor merges these mixins with the current schema.
			// When a service uses mixins, all properties in the mixin will be “mixed”, merged,
			// into the current service.
			settings: {
				// Schemas will be stored here. This will act as an in-memory cache.
				schemas: {},
			},
			hooks: {
				before: {
					// All actions are processed through the validateAction hook.  If a schema
					// is available, the request will be validated.
					"*": "validateAction"
				}
			},
			actions: {
				listSchemas() {
					return this.settings.schemas || []
				}
			},
			// Wait for the Schema service be up and running
			// dependencies: [schemaServiceName],
			methods: {
				/**
				 * Validate the event payload against the matching schema
				 *
				 * @param {Object} payload incoming data
				 * @param {string} sender service that send the event
				 * @param {string} eventName evnt name
				 *
				 * @throws {ValidationError}
				 *
				 * @returns {Promise}
				 */
				validateEvent(payload, sender, eventName) {
					return new Promise((resolve, reject) => {
						if (
							!ajv.validate(
								this.settings.schemas[eventName],
								payload
							)
						) {
							return reject(
								new ValidationError(
									`${sender} emitted an invalid payload for the ${eventName} event`,
									ajv.errors
								)
							);
						}

						return resolve();
					});
				},
				/**
				 * Validate the action payload against the matching schema
				 *
				 * @param {Object} payload incoming data
				 * @param {string} sender service that send the event
				 * @param {string} eventName evnt name
				 *
				 * @throws {ValidationError}
				 *
				 * @returns {Promise}
				 */
				async validateAction(ctx) {
					const actionName = ctx.action.name;

					if (this.settings.schemas[actionName]) {
						if (
							!ajv.validate(
								this.settings.schemas[actionName],
								ctx.params
							)
						) {
							throw new ValidationError(
								`Invalid payload for the ${actionName} event`,
								ajv.errors
							);
						}
					} else {
						throw new MISSING_SCHEMA(actionName);
					}
				},

				loadAllSchemasFromDisk: loadAllSchemasFromDisk,
				loadSchemaFromDisk: loadSchemaFromDisk
			},
			// Service lifecycle hook
			started() {
				if (process.env.SCHEMA_DIR && path.resolve(process.env.SCHEMA_DIR)) {
					console.log("======================= LOADING SERVICE SCHEMAS =======================");
					loadAllSchemasFromDisk(this, process.env.SCHEMA_DIR);
				} else {
					throw new MISSING_SCHEMA_DIR_ENV_VAR();
				}
			}
		}
	};
};

module.exports = exports = MoleculerSchemaAdaptor;
