'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

exports.denormalize = denormalize;

var _DictionarySchema = require('normalizr/lib/DictionarySchema');

var _DictionarySchema2 = _interopRequireDefault(_DictionarySchema);

var _IterableSchema = require('normalizr/lib/IterableSchema');

var _IterableSchema2 = _interopRequireDefault(_IterableSchema);

var _EntitySchema = require('normalizr/lib/EntitySchema');

var _EntitySchema2 = _interopRequireDefault(_EntitySchema);

var _UnionSchema = require('normalizr/lib/UnionSchema');

var _UnionSchema2 = _interopRequireDefault(_UnionSchema);

var _merge = require('lodash/merge');

var _merge2 = _interopRequireDefault(_merge);

var _isObject = require('lodash/isObject');

var _isObject2 = _interopRequireDefault(_isObject);

var _ImmutableUtils = require('./ImmutableUtils');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

/**
 * Take either an entity or id and derive the other.
 *
 * @param   {object|Immutable.Map|number|string} entityOrId
 * @param   {object|Immutable.Map} entities
 * @param   {Schema} schema
 * @returns {object}
 */
function resolveEntityOrId(entityOrId, entities, schema) {
  var key = schema.getKey();

  var entity = entityOrId;
  var id = entityOrId;

  if ((0, _isObject2.default)(entityOrId)) {
    id = (0, _ImmutableUtils.getIn)(entity, [schema.getIdAttribute()]);
  } else {
    entity = (0, _ImmutableUtils.getIn)(entities, [key, id]);
  }

  return { entity: entity, id: id };
}

/**
 * Denormalizes each entity in the given array.
 *
 * @param   {Array|Immutable.List} items
 * @param   {object|Immutable.Map} entities
 * @param   {Schema} schema
 * @param   {object} bag
 * @returns {Array|Immutable.List}
 */
function denormalizeIterable(items, entities, schema, bag) {
  var itemSchema = schema.getItemSchema();

  return items.map(function (o) {
    return denormalize(o, entities, itemSchema, bag);
  });
}

function denormalizeKeyedObject(items, entities, schema, bag) {
  var keyName = schema.getDictionaryStoredKeyName();

  if ((0, _isObject2.default)(items)) {
    var _ret = function () {
      var itemSchema = schema.getItemSchema();
      return {
        v: Object.keys(items).reduce(function (result, key) {
          var item = denormalize(items[key], entities, itemSchema, bag);
          delete item[keyName];

          result[key] = item;
          return result;
        }, {})
      };
    }();

    if ((typeof _ret === 'undefined' ? 'undefined' : _typeof(_ret)) === "object") return _ret.v;
  } else {
    var denormalizedItems = denormalizeIterable(items, entities, schema, bag);

    return denormalizedItems.reduce(function (result, item) {
      var key = item[keyName];
      delete item[keyName];

      result[key] = item;
      return result;
    }, {});
  }
}

/**
 * @param   {object|Immutable.Map|number|string} entity
 * @param   {object|Immutable.Map} entities
 * @param   {Schema} schema
 * @param   {object} bag
 * @returns {object|Immutable.Map}
 */
function denormalizeUnion(entity, entities, schema, bag) {
  var itemSchema = schema.getItemSchema();
  return denormalize(Object.assign({}, entity, _defineProperty({}, entity.schema, entity.id)), entities, itemSchema, bag)[entity.schema];
}

/**
 * Takes an object and denormalizes it.
 *
 * Note: For non-immutable objects, this will mutate the object. This is
 * necessary for handling circular dependencies. In order to not mutate the
 * original object, the caller should copy the object before passing it here.
 *
 * @param   {object|Immutable.Map} obj
 * @param   {object|Immutable.Map} entities
 * @param   {Schema} schema
 * @param   {object} bag
 * @returns {object|Immutable.Map}
 */
function denormalizeObject(obj, entities, schema, bag) {
  var denormalized = obj;

  Object.keys(schema).filter(function (attribute) {
    return typeof (0, _ImmutableUtils.getIn)(obj, [attribute]) !== 'undefined';
  }).forEach(function (attribute) {

    var item = (0, _ImmutableUtils.getIn)(obj, [attribute]);
    var itemSchema = (0, _ImmutableUtils.getIn)(schema, [attribute]);

    denormalized = (0, _ImmutableUtils.setIn)(denormalized, [attribute], denormalize(item, entities, itemSchema, bag));
  });

  return denormalized;
}

/**
 * Takes an entity, saves a reference to it in the 'bag' and then denormalizes
 * it. Saving the reference is necessary for circular dependencies.
 *
 * @param   {object|Immutable.Map|number|string} entityOrId
 * @param   {object|Immutable.Map} entities
 * @param   {Schema} schema
 * @param   {object} bag
 * @returns {object|Immutable.Map}
 */
function denormalizeEntity(entityOrId, entities, schema, bag) {
  var key = schema.getKey();

  var _resolveEntityOrId = resolveEntityOrId(entityOrId, entities, schema);

  var entity = _resolveEntityOrId.entity;
  var id = _resolveEntityOrId.id;


  if (!bag.hasOwnProperty(key)) {
    bag[key] = {};
  }

  if (!bag[key].hasOwnProperty(id)) {
    // Ensure we don't mutate it non-immutable objects
    var obj = (0, _ImmutableUtils.isImmutable)(entity) ? entity : (0, _merge2.default)({}, entity);

    // Need to set this first so that if it is referenced within the call to
    // denormalizeObject, it will already exist.
    bag[key][id] = obj;
    bag[key][id] = denormalizeObject(obj, entities, schema, bag);
  }

  return bag[key][id];
}

/**
 * Takes an object, array, or id and returns a denormalized copy of it. For
 * an object or array, the same data type is returned. For an id, an object
 * will be returned.
 *
 * If the passed object is null or undefined or if no schema is provided, the
 * passed object will be returned.
 *
 * @param   {object|Immutable.Map|array|Immutable.list|number|string} obj
 * @param   {object|Immutable.Map} entities
 * @param   {Schema} schema
 * @param   {object} bag
 * @returns {object|Immutable.Map|array|Immutable.list}
 */
function denormalize(obj, entities, schema) {
  var bag = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};

  if (obj === null || typeof obj === 'undefined' || !(0, _isObject2.default)(schema)) {
    return obj;
  }

  if (schema instanceof _EntitySchema2.default) {
    return denormalizeEntity(obj, entities, schema, bag);
  } else if (schema instanceof _DictionarySchema2.default) {
    return denormalizeKeyedObject(obj, entities, schema, bag);
  } else if (schema instanceof _IterableSchema2.default) {
    return denormalizeIterable(obj, entities, schema, bag);
  } else if (schema instanceof _UnionSchema2.default) {
    return denormalizeUnion(obj, entities, schema, bag);
  } else {
    // Ensure we don't mutate it non-immutable objects
    var entity = (0, _ImmutableUtils.isImmutable)(obj) ? obj : (0, _merge2.default)({}, obj);
    return denormalizeObject(entity, entities, schema, bag);
  }
}