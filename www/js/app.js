(function (root) {
  'use strict';

  var api = root.CordovaCheckoutDatabase;
  var records = [];
  var selectedId = null;
  var started = false;

  function element(id) {
    return document.getElementById(id);
  }

  function setActivationStatus(text, kind) {
    var status = element('activation-state');
    status.textContent = text;
    status.className = 'status ' + kind;
  }

  function showStartupError(error) {
    var output = element('startup-error');
    output.textContent = api.errorMessage(error);
    output.hidden = false;
  }

  function formatDate(value) {
    var date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
  }

  function render() {
    var list = element('checkout-list');
    list.replaceChildren();
    element('checkout-count').textContent = String(records.length);
    if (records.length === 0) {
      var empty = document.createElement('p');
      empty.className = 'empty muted';
      empty.textContent = 'No checkouts found.';
      list.appendChild(empty);
      return;
    }

    records.forEach(function (record) {
      var button = document.createElement('button');
      button.className = 'checkout-row' + (record.id === selectedId ? ' selected' : '') +
        (record.returned ? ' returned' : '');
      button.type = 'button';
      var equipment = document.createElement('strong');
      equipment.textContent = record.equipment;
      var borrower = document.createElement('span');
      borrower.textContent = record.returned ? 'Returned · ' + record.borrower : 'With ' + record.borrower;
      var date = document.createElement('small');
      date.textContent = formatDate(record.checked_out_at);
      button.append(equipment, borrower, date);
      button.addEventListener('click', function () { select(record.id); });
      list.appendChild(button);
    });
  }

  async function reload(selectId) {
    records = await api.list(element('search').value);
    selectedId = typeof selectId === 'number' ? selectId : selectedId;
    render();
  }

  function select(id) {
    var record = records.find(function (item) { return item.id === id; });
    if (!record) {
      return;
    }
    selectedId = id;
    element('editor-heading').textContent = 'Edit checkout';
    element('equipment').value = record.equipment;
    element('borrower').value = record.borrower;
    element('notes').value = record.notes;
    element('returned').checked = Boolean(record.returned);
    element('delete-button').hidden = false;
    element('editor-status').textContent = 'Checked out ' + formatDate(record.checked_out_at);
    render();
  }

  function resetEditor() {
    selectedId = null;
    element('editor-heading').textContent = 'New checkout';
    element('equipment').value = '';
    element('borrower').value = '';
    element('notes').value = '';
    element('returned').checked = false;
    element('delete-button').hidden = true;
    element('editor-status').textContent = 'Ready';
    render();
  }

  async function openRegister() {
    element('startup-error').hidden = true;
    var button = element('open-button');
    button.disabled = true;
    try {
      await api.open(element('database-key').value);
      element('database-key').value = '';
      element('startup-card').hidden = true;
      element('workspace').hidden = false;
      await reload();
      resetEditor();
    } catch (error) {
      showStartupError(error);
      button.disabled = false;
    }
  }

  async function saveCheckout() {
    var equipment = element('equipment').value.trim();
    var borrower = element('borrower').value.trim();
    var notes = element('notes').value.trim();
    var returned = element('returned').checked;
    if (!equipment || !borrower) {
      element('editor-status').textContent = 'Equipment and borrower are required.';
      return;
    }
    try {
      if (selectedId === null) {
        selectedId = await api.add(equipment, borrower, notes, returned);
        element('editor-status').textContent = 'Checkout added.';
      } else {
        await api.update(selectedId, equipment, borrower, notes, returned);
        element('editor-status').textContent = 'Checkout updated.';
      }
      await reload(selectedId);
    } catch (error) {
      element('editor-status').textContent = 'Save failed: ' + api.errorMessage(error);
    }
  }

  async function deleteCheckout() {
    if (selectedId === null) {
      return;
    }
    try {
      await api.remove(selectedId);
      await reload();
      resetEditor();
      element('editor-status').textContent = 'Checkout deleted.';
    } catch (error) {
      element('editor-status').textContent = 'Delete failed: ' + api.errorMessage(error);
    }
  }

  async function start() {
    if (started) {
      return;
    }
    started = true;
    try {
      var config = root.SQLiteEncryptedConfig || {};
      await api.activateAndValidate(config.activationKey);
      setActivationStatus('SQLite.Encrypted is ready', 'ready');
      element('open-button').disabled = false;
    } catch (error) {
      setActivationStatus('SQLite.Encrypted could not start', 'failed');
      showStartupError(error);
    }
  }

  element('open-button').addEventListener('click', openRegister);
  element('new-button').addEventListener('click', resetEditor);
  element('save-button').addEventListener('click', saveCheckout);
  element('delete-button').addEventListener('click', deleteCheckout);
  element('search').addEventListener('input', function () {
    reload().catch(function (error) {
      element('editor-status').textContent = 'Search failed: ' + api.errorMessage(error);
    });
  });
  document.addEventListener('deviceready', start, false);
  setTimeout(function () {
    if (!started) {
      showStartupError('Cordova did not finish loading the native plugins. Prepare the platform and rebuild the app.');
    }
  }, 15000);
}(window));

