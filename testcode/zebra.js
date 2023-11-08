const net = require('net');

// ZPL Command(s) to send to the printer - Example here is a simple text label
const zplCommand = `
^XA
^FO50,50^ADN,36,20^FDHello, Zebra!^FS
^XZ
`;

// Printer IP and port (usually 9100 for Zebra printers)
const printerIP = '10.32.3.38';
const port = 9100;

// Create a socket connection to the printer
const client = new net.Socket();
client.connect(port, printerIP, () => {
    console.log('Connected to printer');
    client.write(zplCommand);
});

client.on('data', (data) => {
    console.log('Received: ' + data);
    client.destroy(); // kill client after server's response
});

client.on('close', () => {
    console.log('Connection closed');
});

client.on('error', (error) => {
    console.error('Error: ' + error);
});
