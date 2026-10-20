(function (root) {
  'use strict';

  var DATABASE_NAME = 'encrypted-equipment-checkout.db';
  var ACTIVATION_CHECK_NAME = 'sqlite-encrypted-activation-check.db';
  var ACTIVATION_CHECK_KEY = 'temporary activation validation key';
  var database = null;

  function message(error) {
    return error && typeof error.message === 'string' ? error.message : String(error);
  }

  function requirePlugin() {
    if (!root.sqlitePlugin) {
      throw new Error('The SQLite.Encrypted Cordova plugin is unavailable. Prepare the platform and rebuild the native app.');
    }
    return root.sqlitePlugin;
  }

  function activateSEE(key) {
    return new Promise(function (resolve, reject) {
      requirePlugin().activateSEE(key, resolve, reject);
    });
  }

  function openDatabase(options) {
    return new Promise(function (resolve, reject) {
      var opened = requirePlugin().openDatabase(options, function () {
        resolve(opened);
      }, reject);
    });
  }

  function closeDatabase(opened) {
    return new Promise(function (resolve, reject) {
      opened.close(resolve, reject);
    });
  }

  function deleteDatabase(name) {
    return new Promise(function (resolve, reject) {
      requirePlugin().deleteDatabase({name: name, location: 'default'}, resolve, reject);
    });
  }

  function execute(opened, sql, values) {
    return new Promise(function (resolve, reject) {
      opened.executeSql(sql, values || [], resolve, function (error) {
        reject(error);
        return false;
      });
    });
  }

  function applyKey(opened, key) {
    return new Promise(function (resolve, reject) {
      opened.key(null, key, null, resolve, reject);
    });
  }

  async function deleteIfPresent(name) {
    try {
      await deleteDatabase(name);
    } catch (_) {
      // A missing database is already the desired state.
    }
  }

  async function activateAndValidate(activationKey) {
    if (!activationKey) {
      throw new Error('SQLITE_ENCRYPTED_ACTIVATION_KEY was not supplied when the app was prepared.');
    }
    if (activationKey.indexOf('see-') === 0) {
      throw new Error('SQLITE_ENCRYPTED_ACTIVATION_KEY must not include the see- prefix.');
    }

    await deleteIfPresent(ACTIVATION_CHECK_NAME);
    var checkDatabase;
    try {
      await activateSEE(activationKey);
      checkDatabase = await openDatabase({name: ACTIVATION_CHECK_NAME, location: 'default'});
      await applyKey(checkDatabase, ACTIVATION_CHECK_KEY);
      await execute(checkDatabase, 'SELECT count(*) AS count FROM sqlite_master');
      await closeDatabase(checkDatabase);
      checkDatabase = null;
    } catch (error) {
      throw new Error(
        'SQLite.Encrypted could not activate SEE. Verify the activation key for this platform and restart the app. Details: ' +
        message(error)
      );
    } finally {
      if (checkDatabase) {
        try { await closeDatabase(checkDatabase); } catch (_) {}
      }
      await deleteIfPresent(ACTIVATION_CHECK_NAME);
    }
  }

  async function open(passphrase) {
    if (!passphrase) {
      throw new Error('The database passphrase is required.');
    }
    var opened = await openDatabase({
      name: DATABASE_NAME,
      location: 'default',
      key: passphrase
    });
    try {
      await execute(opened, 'SELECT count(*) AS count FROM sqlite_master');
      await execute(opened, [
        'CREATE TABLE IF NOT EXISTS equipment_checkouts (',
        'id INTEGER PRIMARY KEY,',
        'equipment TEXT NOT NULL,',
        'borrower TEXT NOT NULL,',
        'notes TEXT NOT NULL,',
        'checked_out_at TEXT NOT NULL,',
        'returned INTEGER NOT NULL DEFAULT 0',
        ')'
      ].join(' '));
      database = opened;
    } catch (error) {
      try { await closeDatabase(opened); } catch (_) {}
      throw new Error('The encrypted register could not be opened. Verify the database passphrase. Details: ' + message(error));
    }
  }

  function rows(result) {
    var values = [];
    for (var index = 0; index < result.rows.length; index += 1) {
      values.push(result.rows.item(index));
    }
    return values;
  }

  async function list(search) {
    var term = String(search || '').trim();
    var result = term.length === 0
      ? await execute(database, [
        'SELECT id, equipment, borrower, notes, checked_out_at, returned',
        'FROM equipment_checkouts ORDER BY returned, checked_out_at DESC, id DESC'
      ].join(' '))
      : await execute(database, [
        'SELECT id, equipment, borrower, notes, checked_out_at, returned',
        'FROM equipment_checkouts',
        'WHERE equipment LIKE ? OR borrower LIKE ? OR notes LIKE ?',
        'ORDER BY returned, checked_out_at DESC, id DESC'
      ].join(' '), ['%' + term + '%', '%' + term + '%', '%' + term + '%']);
    return rows(result);
  }

  async function add(equipment, borrower, notes, returned) {
    var result = await execute(database, [
      'INSERT INTO equipment_checkouts(equipment, borrower, notes, checked_out_at, returned)',
      'VALUES (?, ?, ?, ?, ?)'
    ].join(' '), [equipment, borrower, notes, new Date().toISOString(), returned ? 1 : 0]);
    return Number(result.insertId);
  }

  async function update(id, equipment, borrower, notes, returned) {
    var result = await execute(database, [
      'UPDATE equipment_checkouts SET equipment = ?, borrower = ?, notes = ?, returned = ?',
      'WHERE id = ?'
    ].join(' '), [equipment, borrower, notes, returned ? 1 : 0, id]);
    return result.rowsAffected === 1;
  }

  async function remove(id) {
    var result = await execute(database, 'DELETE FROM equipment_checkouts WHERE id = ?', [id]);
    return result.rowsAffected === 1;
  }

  root.CordovaCheckoutDatabase = {
    activateAndValidate: activateAndValidate,
    open: open,
    list: list,
    add: add,
    update: update,
    remove: remove,
    errorMessage: message
  };
}(window));

