const sql = require('mssql');
const ErrorLogger = require('../funtions/errorlog');
const logger = new ErrorLogger();
const APIRequest = require('../funtions/APIrequest')
const fs = require('fs');
const path = require('path');
const sourcefile = path.basename(__filename)



let sqlPool;

async function connectToSql() {
  const connectionInfo = await APIRequest.getConnectionInfo(); // Retrieve connection info from the API
  const sqlConfig = {
    user: connectionInfo.UID,
    password: connectionInfo.PWD,
    database: 'SMART_ATE',
    server: connectionInfo.SERVER,
    dialect: "mssql",
    options: {
      trustedConnection: true,
      trustServerCertificate: true,
      enableArithAbort: true,
      instancename: ''
    },
    port: 1433
  };

  if (!sqlPool) {
    try {
      sqlPool = await sql.connect(sqlConfig);
    } catch (err) {
      logger.logError(err, 'connectToSql', sourcefile);
      console.error("Error connecting to SQL: ", err);
      sqlPool = null;
      throw err;
    }
  }

  return sqlPool;
}

async function GetReceverydata() {
  try {
    const pool = await connectToSql();
    const request = new sql.Request(pool);

    const result = await request.query(`
            SELECT 
             PART_NUMBER
            ,DESCRIPTION
            ,MODEL
            ,RECOVER
            ,SITE
            
            FROM APE_SCRAP_RECOVERY_STATUS
    `);
    return result
  } catch (err) {
    logger.logError(err,'GetReceverydata',sourcefile);
    console.error("Error occurred: ", err);
    throw err;
  }
}

async function UpdateReceveryData(recover, part_number, model) {
  try {
    const pool = await connectToSql();
    const request = new sql.Request(pool);
    request.input('recover', sql.Int, recover);
    request.input('part_number', sql.VarChar, part_number);
    request.input('model', sql.VarChar, model);
    const result = await request.query(`
    UPDATE 
        APE_SCRAP_RECOVERY_STATUS
         SET RECOVER = @recover
         WHERE PART_NUMBER = @part_number AND MODEL = @model
    `);
    return result
  } catch (err) {
    logger.logError(err,'UpdateReceveryData',sourcefile);
    console.error("Error occurred: ", err);
    throw err;
  }
}

async function GetWAPStatus(serial) {
  try {
    const pool = await connectToSql();
    const request = new sql.Request(pool);
    request.input('serial', sql.VarChar, serial);

    const result = await request.query(`
    SELECT 
        failcode.FAILTEXT  AS 'Disposition'
        ,item.[MODEL_CODE] AS 'Model'
    FROM [SMART_ATE].[dbo].[ATE_ACCESSORY_STATIONS_DISPO] dispo
    INNER JOIN [SMART_ATE].[dbo].[ATE_ACCESSORY] item ON item.[ATE_ACCESSORY_ITEMS_MODELS_OBJID] = dispo.[ATE_ACCESSORY_ITEMS_MODELS_OBJID]
    INNER JOIN [SMART_ATE].[dbo].ATE_FAILCODES failcode on dispo.FAILTEXT = failcode.ATE_FAILCODES_OBJID
    where item.SERIAL_NUMBER=@serial and dispo.APE_MAIN_TV_OPERATION_OBJID = '32'
    `);
    return result
  } catch (err) {
    logger.logError(err,'GetWAPStatus',sourcefile);
    console.error("Error occurred: ", err);
    throw err;
  }
}

async function GetEmployeeDetails(ntLogin) {
  try {
    const pool = await connectToSql();
    const request = new sql.Request(pool);
    request.input('nt_login', sql.VarChar, ntLogin);

    const result = await request.query(`
    SELECT TOP (1000) 
        [PERSON_ID],
        [EMPLOYEE_NUMBER],
        [FULL_NAME],
        [FIRST_NAME],
        [LAST_NAME],
        [NT_LOGIN]
    FROM [SMART_ATE].[dbo].[CPER_HR_EMPLOYEE_DETAILS]
    WHERE [NT_LOGIN]=@nt_login
    `);
    return result;
  } catch (err) {
    logger.logError(err, 'GetEmployeeDetails', sourcefile);
    console.error("Error occurred: ", err);
    throw err;
  }
}

async function GetCountByModel(AreaID) {
  try {
    const pool = await connectToSql();
    const request = new sql.Request(pool);
    request.input('AreaID', sql.VarChar, AreaID);

    const result = await request.query(`
      SELECT
        -- Failcode information
        item.MODEL_CODE AS 'Disposition',
        COUNT(item.MODEL_CODE) AS 'Count of Dispositions'
      FROM [SMART_ATE].[dbo].[ATE_ACCESSORY_STATIONS_DISPO] dispo
      INNER JOIN [SMART_ATE].[dbo].[ATE_ACCESSORY] item ON item.[ATE_ACCESSORY_ITEMS_MODELS_OBJID] = dispo.[ATE_ACCESSORY_ITEMS_MODELS_OBJID]
      -- As test name
      INNER JOIN [SMART_ATE].[dbo].[APE_MAIN_TV] test ON test.[APE_MAIN_TV_OBJID] = dispo.[APE_MAIN_TV_OPERATION_OBJID]
      -- As pc data, location
      INNER JOIN [SMART_ATE].[dbo].[SUBPROC_TEXT_VALUES] pc ON pc.[SP_TEXT_VALUES_OBJID] = dispo.[SUBPROC_TEXT_VALUES_PC_OBJID]
      -- As employee data
      INNER JOIN [SMART_ATE].[dbo].[CPER_HR_EMPLOYEE_DETAILS] emp ON emp.[EMPLOYEE_NUMBER] = dispo.[EMPLOYEE_NUMBER]
      -- Failcode
      INNER JOIN [SMART_ATE].[dbo].ATE_FAILCODES failcode on dispo.FAILTEXT = failcode.ATE_FAILCODES_OBJID
      WHERE test.APE_MAIN_TV_OBJID = @AreaID
      AND failcode.FAILTEXT like '%PASS%'
      AND (
        -- Check for current shift
        (
          DATEPART(hour, GETDATE()) BETWEEN 4 AND 15
          AND DATEPART(hour, dispo.LAST_UPDATE) BETWEEN 4 AND DATEPART(hour, GETDATE())
          AND CAST(dispo.LAST_UPDATE AS DATE) = CAST(GETDATE() AS DATE)
        )
        OR
        -- For Shift 2
        (
          (
            DATEPART(hour, GETDATE()) >= 16
            AND DATEPART(hour, dispo.LAST_UPDATE) BETWEEN 16 AND DATEPART(hour, GETDATE())
            AND CAST(dispo.LAST_UPDATE AS DATE) = CAST(GETDATE() AS DATE)
          )
          OR
          (
            DATEPART(hour, GETDATE()) < 4
            AND (
              (DATEPART(hour, dispo.LAST_UPDATE) BETWEEN 16 AND 23 AND CAST(dispo.LAST_UPDATE AS DATE) = CAST(DATEADD(day, -1, GETDATE()) AS DATE))
              OR
              (DATEPART(hour, dispo.LAST_UPDATE) BETWEEN 0 AND DATEPART(hour, GETDATE()) AND CAST(dispo.LAST_UPDATE AS DATE) = CAST(GETDATE() AS DATE))
            )
          )
        )
      )
      GROUP BY 
        item.MODEL_CODE
    `);

      // Format the result into the desired object format
      const formattedResult = {};
      result.recordset.forEach(record => {
        formattedResult[record['Disposition']] = record['Count of Dispositions'];
      });

    return formattedResult;
  } catch (err) {
    logger.logError(err, 'GetModelCount', sourcefile);
    console.error("Error occurred: ", err);
    throw err;
  }
}

async function GetCountbyYield(AreaID) {
  try {
    const pool = await connectToSql();
    const request = new sql.Request(pool);
    request.input('AreaID', sql.VarChar, AreaID);

    const result = await request.query(`
      SELECT
        -- Failcode information
        failcode.FAILTEXT AS 'Disposition',
        COUNT(failcode.FAILTEXT) AS 'Count of Dispositions'
      FROM [SMART_ATE].[dbo].[ATE_ACCESSORY_STATIONS_DISPO] dispo
      INNER JOIN [SMART_ATE].[dbo].[ATE_ACCESSORY] item ON item.[ATE_ACCESSORY_ITEMS_MODELS_OBJID] = dispo.[ATE_ACCESSORY_ITEMS_MODELS_OBJID]
      -- As test name
      INNER JOIN [SMART_ATE].[dbo].[APE_MAIN_TV] test ON test.[APE_MAIN_TV_OBJID] = dispo.[APE_MAIN_TV_OPERATION_OBJID]
      -- As pc data, location
      INNER JOIN [SMART_ATE].[dbo].[SUBPROC_TEXT_VALUES] pc ON pc.[SP_TEXT_VALUES_OBJID] = dispo.[SUBPROC_TEXT_VALUES_PC_OBJID]
      -- As employee data
      INNER JOIN [SMART_ATE].[dbo].[CPER_HR_EMPLOYEE_DETAILS] emp ON emp.[EMPLOYEE_NUMBER] = dispo.[EMPLOYEE_NUMBER]
      -- Failcode
      INNER JOIN [SMART_ATE].[dbo].ATE_FAILCODES failcode on dispo.FAILTEXT = failcode.ATE_FAILCODES_OBJID
      WHERE test.APE_MAIN_TV_OBJID = @AreaID
      AND (
        -- Check for current shift
        (
          DATEPART(hour, GETDATE()) BETWEEN 4 AND 15
          AND DATEPART(hour, dispo.LAST_UPDATE) BETWEEN 4 AND DATEPART(hour, GETDATE())
          AND CAST(dispo.LAST_UPDATE AS DATE) = CAST(GETDATE() AS DATE)
        )
        OR
        -- For Shift 2
        (
          (
            DATEPART(hour, GETDATE()) >= 16
            AND DATEPART(hour, dispo.LAST_UPDATE) BETWEEN 16 AND DATEPART(hour, GETDATE())
            AND CAST(dispo.LAST_UPDATE AS DATE) = CAST(GETDATE() AS DATE)
          )
          OR
          (
            DATEPART(hour, GETDATE()) < 4
            AND (
              (DATEPART(hour, dispo.LAST_UPDATE) BETWEEN 16 AND 23 AND CAST(dispo.LAST_UPDATE AS DATE) = CAST(DATEADD(day, -1, GETDATE()) AS DATE))
              OR
              (DATEPART(hour, dispo.LAST_UPDATE) BETWEEN 0 AND DATEPART(hour, GETDATE()) AND CAST(dispo.LAST_UPDATE AS DATE) = CAST(GETDATE() AS DATE))
            )
          )
        )
      )
      GROUP BY 
        failcode.FAILTEXT
    `);

    // Format the result into the desired object format
    const formattedResult = {};
    result.recordset.forEach(record => {
      formattedResult[record['Disposition']] = record['Count of Dispositions'];
    });

    return formattedResult;

  } catch (err) {
    logger.logError(err, 'GetCountbyYield', sourcefile);
    console.error("Error occurred: ", err);
    throw err;
  }
}

async function GetCountbyEmployee(AreaID) {
  try {
    const pool = await connectToSql();
    const request = new sql.Request(pool);
    request.input('AreaID', sql.VarChar, AreaID);

    const result = await request.query(`
      SELECT
        emp.NT_LOGIN AS 'Name',
        COUNT(emp.NT_LOGIN) AS 'Count'
      FROM [SMART_ATE].[dbo].[ATE_ACCESSORY_STATIONS_DISPO] dispo
      INNER JOIN [SMART_ATE].[dbo].[ATE_ACCESSORY] item ON item.[ATE_ACCESSORY_ITEMS_MODELS_OBJID] = dispo.[ATE_ACCESSORY_ITEMS_MODELS_OBJID]
      INNER JOIN [SMART_ATE].[dbo].[APE_MAIN_TV] test ON test.[APE_MAIN_TV_OBJID] = dispo.[APE_MAIN_TV_OPERATION_OBJID]
      INNER JOIN [SMART_ATE].[dbo].[SUBPROC_TEXT_VALUES] pc ON pc.[SP_TEXT_VALUES_OBJID] = dispo.[SUBPROC_TEXT_VALUES_PC_OBJID]
      INNER JOIN [SMART_ATE].[dbo].[CPER_HR_EMPLOYEE_DETAILS] emp ON emp.[EMPLOYEE_NUMBER] = dispo.[EMPLOYEE_NUMBER]
      INNER JOIN [SMART_ATE].[dbo].ATE_FAILCODES failcode ON dispo.FAILTEXT = failcode.ATE_FAILCODES_OBJID
      WHERE test.APE_MAIN_TV_OBJID = @AreaID
        AND failcode.FAILTEXT LIKE '%PASS%'
        AND (
          (
            DATEPART(hour, GETDATE()) BETWEEN 4 AND 15
            AND DATEPART(hour, dispo.LAST_UPDATE) BETWEEN 4 AND DATEPART(hour, GETDATE())
            AND CAST(dispo.LAST_UPDATE AS DATE) = CAST(GETDATE() AS DATE)
          )
          OR (
            (
              DATEPART(hour, GETDATE()) >= 16
              AND DATEPART(hour, dispo.LAST_UPDATE) BETWEEN 16 AND DATEPART(hour, GETDATE())
              AND CAST(dispo.LAST_UPDATE AS DATE) = CAST(GETDATE() AS DATE)
            )
            OR (
              DATEPART(hour, GETDATE()) < 4
              AND (
                (DATEPART(hour, dispo.LAST_UPDATE) BETWEEN 16 AND 23 AND CAST(dispo.LAST_UPDATE AS DATE) = CAST(DATEADD(day, -1, GETDATE()) AS DATE))
                OR (DATEPART(hour, dispo.LAST_UPDATE) BETWEEN 0 AND DATEPART(hour, GETDATE()) AND CAST(dispo.LAST_UPDATE AS DATE) = CAST(GETDATE() AS DATE))
              )
            )
          )
        )
      GROUP BY emp.NT_LOGIN
      ORDER BY COUNT(emp.NT_LOGIN) DESC
    `);
    
    // Format the result into the desired object format
    const formattedResult = {};
    result.recordset.forEach(record => {
      formattedResult[record['Name']] = record['Count'];
    });

    return formattedResult;
  } catch (err) {
    logger.logError(err, 'GetCountbyStation', sourcefile);
    console.error("Error occurred: ", err);
    throw err;
  }
}

async function GetCountbyStation(AreaID) {
  try {
    const pool = await connectToSql();
    const request = new sql.Request(pool);
    request.input('AreaID', sql.VarChar, AreaID);

    const result = await request.query(`
      SELECT
      pc.DISPLAY_TEXT5 AS 'Name',
        COUNT(pc.DISPLAY_TEXT5) AS 'Count'
      FROM [SMART_ATE].[dbo].[ATE_ACCESSORY_STATIONS_DISPO] dispo
      INNER JOIN [SMART_ATE].[dbo].[ATE_ACCESSORY] item ON item.[ATE_ACCESSORY_ITEMS_MODELS_OBJID] = dispo.[ATE_ACCESSORY_ITEMS_MODELS_OBJID]
      INNER JOIN [SMART_ATE].[dbo].[APE_MAIN_TV] test ON test.[APE_MAIN_TV_OBJID] = dispo.[APE_MAIN_TV_OPERATION_OBJID]
      INNER JOIN [SMART_ATE].[dbo].[SUBPROC_TEXT_VALUES] pc ON pc.[SP_TEXT_VALUES_OBJID] = dispo.[SUBPROC_TEXT_VALUES_PC_OBJID]
      INNER JOIN [SMART_ATE].[dbo].[CPER_HR_EMPLOYEE_DETAILS] emp ON emp.[EMPLOYEE_NUMBER] = dispo.[EMPLOYEE_NUMBER]
      INNER JOIN [SMART_ATE].[dbo].ATE_FAILCODES failcode ON dispo.FAILTEXT = failcode.ATE_FAILCODES_OBJID
      WHERE test.APE_MAIN_TV_OBJID = @AreaID
        AND failcode.FAILTEXT LIKE '%PASS%'
        AND (
          (
            DATEPART(hour, GETDATE()) BETWEEN 4 AND 15
            AND DATEPART(hour, dispo.LAST_UPDATE) BETWEEN 4 AND DATEPART(hour, GETDATE())
            AND CAST(dispo.LAST_UPDATE AS DATE) = CAST(GETDATE() AS DATE)
          )
          OR (
            (
              DATEPART(hour, GETDATE()) >= 16
              AND DATEPART(hour, dispo.LAST_UPDATE) BETWEEN 16 AND DATEPART(hour, GETDATE())
              AND CAST(dispo.LAST_UPDATE AS DATE) = CAST(GETDATE() AS DATE)
            )
            OR (
              DATEPART(hour, GETDATE()) < 4
              AND (
                (DATEPART(hour, dispo.LAST_UPDATE) BETWEEN 16 AND 23 AND CAST(dispo.LAST_UPDATE AS DATE) = CAST(DATEADD(day, -1, GETDATE()) AS DATE))
                OR (DATEPART(hour, dispo.LAST_UPDATE) BETWEEN 0 AND DATEPART(hour, GETDATE()) AND CAST(dispo.LAST_UPDATE AS DATE) = CAST(GETDATE() AS DATE))
              )
            )
          )
        )
      GROUP BY pc.DISPLAY_TEXT5
      ORDER BY COUNT(pc.DISPLAY_TEXT5) DESC
    `);
    
    // Format the result into the desired object format
    const formattedResult = {};
    result.recordset.forEach(record => {
      formattedResult[record['Name']] = record['Count'];
    });

    return formattedResult;
  } catch (err) {
    logger.logError(err, 'GetCountbyStation', sourcefile);
    console.error("Error occurred: ", err);
    throw err;
  }
}


module.exports = { GetReceverydata, UpdateReceveryData, GetWAPStatus, GetEmployeeDetails, GetCountByModel, GetCountbyYield, GetCountbyEmployee, GetCountbyStation}

