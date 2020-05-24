/**
 * Load and save- handlers for the Admin Settings UI (index_m.html)
 */

// This will be called by the admin adapter when the settings page loads
function load(settings, onChange) {
  // select checkbox and text elements with class=value, insert value from settings
  // and add 'change' handler to notify UI's "save" button
  if (!settings) return;
  $('.value').each(function () {
    var $key = $(this);
    var id = $key.attr('id');
    if ($key.attr('type') === 'checkbox') {
      $key.prop('checked', settings[id])
        .on('change', () => onChange())
    } else {
      $key.val(settings[id])
        .on('change', () => onChange())
        .on('keyup', () => onChange())
    }
  });
  onChange(false);
  // reinitialize all the Materialize labels on the page if you are dynamically adding inputs:
  if (M) M.updateTextFields();
}

// This will be called by the admin adapter when the user presses the save button
function save(callback) {
  // eselect checkbox and text elements with class=value and build settings object
  var obj = {};
  $('.value').each(function () {
    var $this = $(this);
    if ($this.attr('type') === 'checkbox') {
      obj[$this.attr('id')] = $this.prop('checked');
    } else {
      obj[$this.attr('id')] = $this.val();
    }
  });
  // standardize URL Inputs (always prepended with protocol) 
  if (obj.url.indexOf("://") == -1) {
    obj.url = "http://" + obj.url
  }
  if (obj.hostip.indexOf("://") == -1) {
    obj.hostip = "http://" + obj.hostip
  }
  callback(obj);
}