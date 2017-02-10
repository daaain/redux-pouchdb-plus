'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.persistentReducer = exports.persistentStore = exports.inSync = undefined;

var _save = require('./save.js');

Object.defineProperty(exports, 'inSync', {
  enumerable: true,
  get: function get() {
    return _save.inSync;
  }
});
exports.reinit = reinit;

var _uuid = require('uuid');

var _uuid2 = _interopRequireDefault(_uuid);

var _lodash = require('lodash.isequal');

var _lodash2 = _interopRequireDefault(_lodash);

var _lodash3 = require('lodash.clonedeep');

var _lodash4 = _interopRequireDefault(_lodash3);

var _immutable = require('immutable');

var _immutable2 = _interopRequireDefault(_immutable);

var _transitImmutableJs = require('transit-immutable-js');

var _transitImmutableJs2 = _interopRequireDefault(_transitImmutableJs);

var _save2 = _interopRequireDefault(_save);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// A client hash to filter out local database changes (as those
// may lead to several race conditions).
// see also http://stackoverflow.com/questions/28280276/changes-filter-only-changes-from-other-db-instances
var CLIENT_HASH = _uuid2.default.v4();

var REINIT = '@@redux-pouchdb-plus/REINIT';
var INIT = '@@redux-pouchdb-plus/INIT';
var SET_REDUCER = '@@redux-pouchdb-plus/SET_REDUCER';

var initializedReducers = {};

function reinit(reducerName) {
  var reducerNames = Object.keys(initializedReducers);

  if (!reducerName) {
    // reinit all reducers
    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
      for (var _iterator = reducerNames[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
        var n = _step.value;

        initializedReducers[n] = false;
      }
    } catch (err) {
      _didIteratorError = true;
      _iteratorError = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion && _iterator.return) {
          _iterator.return();
        }
      } finally {
        if (_didIteratorError) {
          throw _iteratorError;
        }
      }
    }
  } else {
    // reinit a specific reducer
    if (reducerNames.indexOf(reducerName) === -1) throw 'Invalid persistent reducer to reinit: ' + reducerName;

    initializedReducers[reducerName] = false;
  }

  return { type: REINIT, reducerName: reducerName };
}

var persistentStore = exports.persistentStore = function persistentStore() {
  var storeOptions = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  return function (createStore) {
    return function (reducer, initialState) {
      var store = createStore(reducer, initialState);

      store.dispatch({
        type: INIT,
        store: store,
        storeOptions: storeOptions
      });

      return store;
    };
  };
};

var persistentReducer = exports.persistentReducer = function persistentReducer(reducer) {
  var reducerOptions = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

  var initialState = void 0;
  var immutable = void 0;
  var store = void 0;
  var storeOptions = void 0;
  var changes = void 0;
  var saveReducer = void 0;
  var currentState = void 0;

  var reducerNameGiven = reducerOptions.name || reducer.name;
  initializedReducers[reducerNameGiven] = false;

  // call the provide (store only) callback as soon
  // as all persistent reducers are initialized
  function onReady() {
    if (storeOptions.onReady instanceof Function) storeOptions.onReady.call(null, store);
  }

  // call the provided callbacks as soon as this reducer
  // was initialized (loaded from or saved to the db)
  function onInit(state) {
    if (reducerOptions.onInit instanceof Function) reducerOptions.onInit.call(null, reducerNameGiven, state, store);
    if (storeOptions.onInit instanceof Function) storeOptions.onInit.call(null, reducerNameGiven, state, store);
  }

  // call the provided callbacks when this reducer
  // was updated with data from the db
  function onUpdate(state) {
    if (reducerOptions.onUpdate instanceof Function) reducerOptions.onUpdate.call(null, reducerNameGiven, state, store);
    if (storeOptions.onUpdate instanceof Function) storeOptions.onUpdate.call(null, reducerNameGiven, state, store);
  }

  // call the provided callbacks when the state
  // of this reducer was saved to the db
  function onSave(state) {
    if (reducerOptions.onSave instanceof Function) reducerOptions.onSave.call(null, reducerNameGiven, state, store);
    if (storeOptions.onSave instanceof Function) storeOptions.onSave.call(null, reducerNameGiven, state, store);
  }

  // get the current db connector an initialize the state of this
  // reducer by loading it from the db or by saving it
  // to the db (if it is not already persisted there)
  function reinitReducer(state) {
    if (changes) changes.cancel();

    var db = reducerOptions.db || storeOptions.db;
    if (!db) throw 'No db connector provided. ' + 'You must at least provide one to the store or the reducer.';

    if (db instanceof Function) db = db(reducerNameGiven, store);

    saveReducer = (0, _save2.default)(db, CLIENT_HASH);

    db.get(reducerNameGiven).then(function (doc) {
      // set reducer state if there was an entry found in the db
      setReducer(doc);
    }).catch(function (err) {
      // save the reducer state if there was no entry in the db
      if (err.status === 404) return saveReducer(reducerNameGiven, toPouch(state)).then(function () {
        onSave(state);
      });else throw err;
    }).then(function () {
      // from here on the reducer was loaded from db or saved to db
      initializedReducers[reducerNameGiven] = true;
      onInit(currentState);

      var ready = true;
      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;
      var _iteratorError2 = undefined;

      try {
        for (var _iterator2 = Object.keys(initializedReducers)[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
          var reducerName = _step2.value;

          if (!initializedReducers[reducerName]) {
            ready = false;
            break;
          }
        }
      } catch (err) {
        _didIteratorError2 = true;
        _iteratorError2 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion2 && _iterator2.return) {
            _iterator2.return();
          }
        } finally {
          if (_didIteratorError2) {
            throw _iteratorError2;
          }
        }
      }

      if (ready) onReady();

      // listen to changes in the db (e.g. when a replication occurs)
      // and update the reducer state when it happens
      return changes = db.changes({
        include_docs: true,
        live: true,
        since: 'now',
        doc_ids: [reducerNameGiven]
      }).on('change', function (change) {
        if (change.doc.localId !== CLIENT_HASH) {
          if (!change.doc.state) saveReducer(change.doc._id, toPouch(currentState)).then(function () {
            onSave(currentState);
          });else if (!isEqual(fromPouch(change.doc.state), currentState)) setReducer(change.doc);
        }
      });
    });
  }

  // an action to update the current reducer state (used when
  // the state was fetched from the db)
  function setReducer(doc) {
    var _id = doc._id,
        _rev = doc._rev,
        state = doc.state;

    var _state = fromPouch(state);

    store.dispatch({
      type: SET_REDUCER,
      reducer: _id,
      state: _state,
      _rev: _rev
    });
  };

  // Support functions for Immutable js.
  // Immutable.toJS and Immutable.fromJS don't support
  // a mixture of immutable and plain js data.
  // transit-immutable-js would be another option that
  // also would handle this mixture.
  // Unfortunately it serializes to a bit
  // cryptic JSON string that is not so nice to save
  // in PouchDB.
  function isImmutable(x) {
    return _immutable2.default.Iterable.isIterable(x);
  }
  function toPouch(x) {
    if (immutable) return JSON.parse(_transitImmutableJs2.default.toJSON(x));else return (0, _lodash4.default)(x);
  }
  function fromPouch(x) {
    if (immutable) return _transitImmutableJs2.default.fromJSON(JSON.stringify(x));else return (0, _lodash4.default)(x);
  }
  function isEqual(x, y) {
    if (immutable) return _immutable2.default.is(x, y);else return (0, _lodash2.default)(x, y);
  }

  // the proxy function that wraps the real reducer
  return function (state, action) {
    switch (action.type) {
      case INIT:
        store = action.store;
        storeOptions = action.storeOptions;
      case REINIT:
        if (!action.reducerName || action.reducerName === reducerNameGiven) {
          reinitReducer(initialState);
          return currentState = initialState;
        } else return state;
      case SET_REDUCER:
        if (action.reducer === reducerNameGiven && action.state) {
          currentState = reducer(action.state, action);
          onUpdate(currentState);
          return currentState;
        }
      default:
        var nextState = reducer(state, action);

        if (!initialState) {
          initialState = nextState;
          immutable = isImmutable(initialState);
        }

        var isInitialized = initializedReducers[reducerNameGiven];
        if (isInitialized && !isEqual(nextState, currentState)) {
          currentState = nextState;
          saveReducer(reducerNameGiven, toPouch(currentState)).then(function () {
            onSave(currentState);
          });
        } else currentState = nextState;

        return currentState;
    }
  };
};