$(document).ready(function() {
  var table = $('#log-result').DataTable({
    ajax: {
      url: '/api/Eventlog',
      dataSrc: 'logEntries'
    },
    columns: [
      { data: 'timestamp', title: 'Timestamp' },
      { data: 'sourceFile', title: 'Source File' }, // Make sure the case matches the JSON property
      { data: 'serviceName', title: 'Service Name' },
      { data: 'sourceFunction', title: 'Source Function' },
      {
        data: 'Message',
        title: 'Message',
        render: function(data, type, row) {
          if (type === 'display') {
            if (data && typeof data === 'object') {
              // Pretty print the object with indentation and add syntax highlighting
              const prettyJson = JSON.stringify(data, null, 2);
              const highlightedJson = prettyJson.replace(/(".*?"|\d+)(?=:)/g, '<span class="json-key">$1</span>');
              return '<pre class="json-pretty">' + highlightedJson + '</pre>';
            } else if (data === null || typeof data === 'undefined') {
              return 'No message';
            }
          }
          return data;
        }
      }
      
    ],
    // Additional options here (optional)
  });

  // Reload table data periodically
  setInterval( function () {
    table.ajax.reload(null, false); // Pass false to not reset pagination
  }, 5000 );
});
