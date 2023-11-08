const { MongoClient } = require('mongodb');

const connectionString = "mongodb://CHY-ELPLABVEWP1:27017";

const client = new MongoClient(connectionString, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

async function updateTimestamps() {
    try {
        await client.connect();
        const db = client.db("ELP");

        const cursor = db.collection('OEE').find({});

        while(await cursor.hasNext()) {
            const doc = await cursor.next();
            const oldDateStr = doc.ts; // assuming it's a string like "2023-05-10T23:08:21.409Z"

            // Check if oldDateStr is a string before attempting to convert to Date
            if (typeof oldDateStr === 'string') {
                // Convert the string to a Date object
                const newDate = new Date(oldDateStr);

                // If the conversion was successful, update the document
                if (!isNaN(newDate.getTime())) {
                    await db.collection('OEE').updateOne(
                        { _id: doc._id },
                        { $set: { ts: newDate } }  // Note: newDate is a Date object, not a string
                    );
                    console.log(`Updated document with id: ${doc._id}`);
                } else {
                    console.log(`Skipped document with id: ${doc._id}. Could not convert 'ts' field to a Date.`);
                }
            } else {
                console.log(`Skipped document with id: ${doc._id}. 'ts' field is not a string.`);
            }
        }
    } catch (error) {
        console.error("Error updating documents", error);
    } finally {
        await client.close();
    }
}

updateTimestamps();
