const { MongoClient } = require('mongodb');

// Update the connection string to use your new URI
const connectionString = "mongodb://pcv1engmongo01:27017/?tls=true";

const client = new MongoClient(connectionString, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    tls: true,  // Enable TLS/SSL. Note that this is equivalent to `tls=true` in the connection string
    tlsInsecure: true, // Disable server certificate validation (You may want to remove this option in a production environment)
});

async function deleteRecordsWithBn() {
    try {
        await client.connect();
        const db = client.db("ELP");
        
        // Specify the query to find documents with bn equal to "Labview App"
        const query = { bn: "PLC OEE" };

        // Use the query in the find operation
        const cursor = db.collection('OEE').find(query);
        
        while(await cursor.hasNext()) {
            const doc = await cursor.next();
            
            // Delete the document
            await db.collection('OEE').deleteOne({ _id: doc._id });
            console.log(`Deleted document with id: ${doc._id}`);
        }
    } catch (error) {
        console.error("Error deleting documents", error);
    } finally {
        await client.close();
    }
}

// Call the function to start deleting documents
deleteRecordsWithBn();
