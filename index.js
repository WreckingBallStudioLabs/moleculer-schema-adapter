/**
 * The intention of this package is to provide schema validation for incoming
 * requests for both actions and events. It allows each service to act as a
 * decentralized schema validation authority.
 *
 * These incoming requests are automatically validated if a matching schema
 * exists. To enable it, the returned middleware must be added to the broker
 * middlewares array and the mixin to the mixin array.
 */

"use strict";

const Ajv = require("ajv");
const ajv = Ajv({
	allErrors: true
});

const helpers = require("./helpers");
const CNE = require("./errors");

//////
// Starts here
//////

/**
 * Moleculer Schema Adaptor factory
 *
 * @param {Object} [settings]
 * @param {string} [settings.schemaDir="schemas"] Schemas folder
 */
const MoleculerSchemaAdaptor = settings => {

	// Default values
	if (!settings) settings = {
		schemaDir: process.env.SCHEMA_DIR || "schemas"
	};

	return {
		middleware: {
			// Listen and validates all incoming events
			localEvent(next, broker) {
				return (payload, sender, topic) => {
					try {
						broker.service.validateEvent(payload, sender, topic);
					} catch (error) {
						this.logger.error(
							"middleware::localEvent::return::validateEvent::invalid",
							error
						);
					}

					return next(payload, sender, topic);
				};
			}
		},

		// The Moleculer Service constructor merges these mixins with the current schema.
		// When a service uses mixins, all properties in the mixin will be “mixed”, merged,
		// into the current service.
		mixin: {
			settings: {
				// Schemas will be stored here. This will act as an in-memory cache.
				schemas: {},
			},
			hooks: {
				before: {
					// All actions are processed through the validateAction hook.
					// If a schema is available, the request will be validated.
					"*": "validateAction"
				}
			},
			actions: {
				listSchemas() {
					return this.settings.schemas || [];
				}
			},
			methods: {
				/**
				 * Validate the event payload against the matching schema
				 *
				 * @param {Object} payload incoming data
				 * @param {string} sender caller
				 * @param {string} eventName event name
				 *
				 * @throws {INVALID_PAYLOAD}
				 * @throws {MISSING_SCHEMA}
				 */
				validateEvent(payload, sender, eventName) {
					if (this.settings.schemas[eventName]) {
						if (
							!ajv.validate(
								this.settings.schemas[eventName],
								payload
							)
						) {
							throw new CNE.INVALID_PAYLOAD(eventName, ajv.errors);
						}
					} else {
						throw new CNE.MISSING_SCHEMA(eventName);
					}
				},
				/**
				 * Validate the action payload against the matching schema
				 *
				 * @param {Object} ctx action context
				 *
				 * @throws {INVALID_PAYLOAD}
				 * @throws {MISSING_SCHEMA}
				 */
				validateAction(ctx) {
					// Bypass its own action
					if (ctx.action.rawName === "listSchemas") return;

					const actionName = ctx.action.name;

					if (this.settings.schemas[actionName]) {
						if (
							!ajv.validate(
								this.settings.schemas[actionName],
								ctx.params
							)
						) {
							throw new CNE.INVALID_PAYLOAD(actionName, ajv.errors);
						}
					} else {
						throw new CNE.MISSING_SCHEMA(actionName);
					}
				},
			},
			// Service lifecycle hook
			started() {
				helpers.loadAllSchemasFromDisk(this, settings.schemaDir);
			}
		}
	};
};

module.exports = exports = MoleculerSchemaAdaptor;
