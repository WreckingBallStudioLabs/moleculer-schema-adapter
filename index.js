/**
 * The intention of this package is to facilitate the integration with a Schema service.
 * The main responsibility of this service is to reduce the burden of managing schemas,
 * and in a distributed way, centralize all schemas used by a system.
 *
 * Within this package, in an automated way, communication between services can be validated.
 * To achieve that, just add the middleware to the moleculer configuration, and the mixin to the
 * moleculer service.
 */

const Ajv = require("ajv");
const ajv = Ajv({ allErrors: true });
const { ValidationError } = require("moleculer").Errors;

let retryTracker = 0;

//////
// Convenience functions
// @see https://softwareengineering.stackexchange.com/a/272812
//////

/**
 * Connect to the Schema service
 *
 * @param {Object} ctx context
 * @param {string} schemaServiceName Schema service name
 * @param {string} actionName Action name
 * @param {Array<string>} registeredEvents list of Service's registered events
 */
const matchEventToSchema = (ctx, schemaServiceName, actionName, registeredEvents) => {
	// Match each event to a schema.
	Object.keys(registeredEvents).forEach(async (eventName) => {
		const schema = await ctx.broker.call(`v1.${schemaServiceName}.${actionName}`, {
			id: eventName
		});

		// Safe guard:
		//
		// It's possible to exist an event, but not a schema for that.
		// In this case, it should call the notification system, and report
		// the anomaly.
		if (schema) {
			// Cache schema
			ctx.settings.schemas[eventName] = schema;
			ajv.addSchema(ctx.settings.schemas[eventName], eventName);
			ctx.broker.logger.debug(`Successfully loaded ${eventName} schema`);
		} else {
			ctx.broker.logger.error(`Warning: Couldn't found a schema to match the ${eventName} event`);

			// TODO: Integrate with the Notification Service
		}
	});
};

//////
// Helper functions
// @see https://softwareengineering.stackexchange.com/a/272812
//////

/**
 * Connect to the Schema service
 *
 * @param {Object} ctx context
 * @param {string} schemaServiceName Schema service name
 * @param {string} actionName Action name
 * @param {Object} [settings]
 * @param {number} [settings.retryThreshold=10] How times should try until fail
 * @param {number} [settings.retryTimeout=5000] Timeout, in ms
 */
const connect = async (ctx, schemaServiceName, actionName, settings) => {
	try {
		await ctx.broker.call(`v1.${schemaServiceName}.ping`);

		// Update state
		ctx.settings.connectedToSchemaService = true;

		const registeredEvents = ctx.schema.events;

		// Only proceed if there are registered events
		if (Object.keys(registeredEvents).length > 0) {
			ctx.broker.logger.debug("mixin::started::registeredEvents", registeredEvents);
			matchEventToSchema(ctx, schemaServiceName, actionName, registeredEvents);
		} else {
			ctx.broker.logger.warn("Service has no registered events");
		}
	} catch (error) {
		// Called if service is not available in 10 seconds
		ctx.broker.logger.warn(`Could not reach ${schemaServiceName} service `);

		if (retryTracker < settings.retryThreshold) {
			setTimeout(() => {
				// Update the tracker
				retryTracker++;

				// Controlled recursive call
				connect(ctx, schemaServiceName, actionName, settings);
			}, settings.retryTimeout);
		} else {
			// Called if service is not available in 10 seconds
			ctx.broker.logger.warn(`Failed to retry connection to the ${schemaServiceName} service`);

			// TODO: Integrate with the Notification Service
		}
	}
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
 * @param {number} [settings.retryThreshold=10] How times should try until fail
 * @param {number} [settings.retryTimeout=5000] Timeout, in ms
 */
const MoleculerSchemaAdaptor = (schemaServiceName, actionName, settings) => {
	// Default options
	schemaServiceName = schemaServiceName || "schema";
	actionName = actionName || "fetch";

	if (!settings) settings = {};
	Object.assign(settings, {
		retryThreshold: 10,
		retryTimeout: 5000 // in ms
	});

	return {
		middleware: {
			// Listen to all incoming events
			localEvent(next, broker) {
				return (payload, sender, topic) => {
					// Call method
					broker.service.validateEvent(payload, sender, topic)
						// Validation succeed :)
						.then(() => {})
						// Validation failed :(
						.catch((error) => {
							this.logger.error("middleware::localEvent::return::validateEvent::invalid", error);

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
			name: "",
			settings: {
				// "State machine"
				connectedToSchemaService: false,

				// Schemas will be stored here. This will act as an in-memory cache.
				schemas: {}
			},
			// Wait for the Schema service be up and running
			// dependencies: [schemaServiceName],
			methods: {
				/**
				 * Validate the payload against the matching schema
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
						if (!this.settings.connectedToSchemaService) {
							this.logger.warn(`Event ${eventName} was processed without validation. Schema service connection is offline`);
							resolve();
						}
						if (!ajv.validate(this.settings.schemas[eventName], payload)) {
							return reject(new ValidationError(`${sender} emitted an invalid payload for the ${eventName} event`, ajv.errors));
						}
						return resolve();
					});
				}
			},
			// Service lifecycle hook
			started() {
				connect(this, schemaServiceName, actionName, settings);
			}
		}
	};
};

module.exports = exports = MoleculerSchemaAdaptor;
