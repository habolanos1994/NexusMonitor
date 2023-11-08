const { Controller, Tag } = require("st-ethernet-ip");
const fs = require('fs');
const path = require('path');

const PLC_TIMEOUT = 3000;
const sourcefile = path.basename(__filename);
const PLC = new Controller({ timeout: PLC_TIMEOUT });

async function getFileTagConfigs(TagConfigPath) {
    const tagConfigFullPath = path.join(__dirname, '..', 'jsonfiles', TagConfigPath);
    if (!fs.existsSync(tagConfigFullPath)) {
        throw new Error(`Tag config file not found at ${tagConfigFullPath}`);
    }
    const tagConfigContent = fs.readFileSync(tagConfigFullPath, 'utf8');
    return new Set(JSON.parse(tagConfigContent).map(tag => tag.name));
}

function getPLCTagConfigs(taglist) {
    return new Set(taglist.map(tag => tag.name));
}

async function ValidateTags(PLCconfigTags) {
    // Ensure PLCconfigTags is an array
    const tagObjects = Array.from(PLCconfigTags).map(tagName => new Tag(tagName));
    let validTags = {};
    let invalidTagNames = new Set();

    try {
        await Promise.all(tagObjects.map(tag => PLC.readTag(tag)));
        tagObjects.forEach(tag => {
            if (tag.value !== null) {
                validTags[tag.name] = tag.value;
            } else {
                invalidTagNames.add(tag.name);
            }
        });
    } catch (error) {
        console.error(`Error reading tags:`, error);
    }

    return {
        validTags,
        invalidTagNames
    };
}

async function PLCConnectionStatus(IPAddress, TagConfigPath, ControllerName) {
    let data = {
        PLCName: ControllerName,
        PLCStatus: false,
        PLCTags: new Set(),
        PLCconfigTags: new Set(),
        PLCproperties: {},
        PLCTagsError: new Set()
    };

    try {
        data.PLCconfigTags = await getFileTagConfigs(TagConfigPath);
        await PLC.connect(IPAddress, 0);
        data.PLCproperties = PLC.properties;
        data.PLCTags = getPLCTagConfigs(PLC.tagList);

        const { validTags, invalidTagNames } = await ValidateTags(data.PLCconfigTags);
        data.PLCStatus = invalidTagNames.size === 0;
        data.PLCTagsError = invalidTagNames;
        data.PLCconfigTags = validTags

        console.log(`Connected to PLC: ${data.PLCName}`);
    } catch (error) {
        console.error(`Failed to connect to PLC at ${IPAddress}:`, error);
        data.error = error;
        await disconnectFromPLC();
    }
    disconnectFromPLC();
    return data;
}

PLC.on('Disconnected', () => {
    console.log(`PLC disconnected from ${PLC.properties.name}`);
});

PLC.on('Error', async (err) => {
    console.error(`PLC Error:`, err);
    await disconnectFromPLC();
});

async function disconnectFromPLC() {
    try {
        await PLC.disconnect();
        console.log('Successfully disconnected from PLC');
    } catch (error) {
        console.error('Error while disconnecting from PLC:', error);
    }
}

module.exports = { PLCConnectionStatus };
