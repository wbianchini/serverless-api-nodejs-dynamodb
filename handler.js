const { v4: uuidv4 } = require('uuid');
const AWS = require('aws-sdk')

const dynamoDb = new AWS.DynamoDB.DocumentClient();

const params = {
  TableName: process.env.NOTIFICATIONS_TABLE,
};

module.exports.showMessage = async event => {
  const { notificationsId } = event.pathParameters
  try {
    const data = await dynamoDb
      .get({
        ...params,
        Key: {
          notification_id: notificationsId
        }
      })
      .promise()

    if (!data.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Notification not found' }, null, 2)
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify(data.Item),
    }
  } catch (err) {
    return {
      statusCode: err.statusCode ? err.statusCode : 500,
      body: JSON.stringify({
        error: err.name ? err.name : "Exception",
        message: err.message ? err.message : "Unknown error",
      })
    }
  }
}

module.exports.storeMessage = async event => {
  try {
    const timestamp = new Date().getTime()

    let dados = JSON.parse(event.body)

    const {
      notification_id, tenant, statusNew, statusPrevious, order_id, statusNewCreatedAt
    } = dados

    const notification = {
      notification_id: uuidv4(),
      tenant,
      statusNew,
      statusPrevious,
      order_id,
      statusNewCreatedAt: timestamp
    }
    await dynamoDb
      .put({
        ...params,
        Item: notification
      })
      .promise()

    return {
      statusCode: 201,
    }
  } catch (err) {
    console.log("Error", err)
    return {
      statusCode: err.statusCode ? err.statusCode : 500,
      body: JSON.stringify({
        error: err.name ? err.name : "Exception",
        message: err.message ? err.message : "Unknown error",
      })
    }
  }
}

module.exports.updateMessage = async event => {
  const { notificationsId } = event.pathParameters

  try {
    const timestamp = new Date().getTime()

    let dados = JSON.parse(event.body)

    const {
      tenant, statusNew, statusPrevious, order_id, statusNewCreatedAt
    } = dados

    await dynamoDb
      .update({
        ...params,
        Key: {
          notification_id: notificationsId
        },
        UpdateExpression:
          'SET tenant = :tenant, statusNew = :statusNew, statusPrevious = :statusPrevious,'
          + ' order_id = :order_id, statusNewCreatedAt = :statusNewCreatedAt',
        ConditionExpression: 'attribute_exists(notification_id)',
        ExpressionAttributeValues: {
          ':tenant': tenant,
          ':statusNew': statusNew,
          ':statusPrevious': statusPrevious,
          ':order_id': order_id,
          ':statusNewCreatedAt': timestamp,
        }
      })
      .promise()

    return {
      statusCode: 204,
    }
  } catch (err) {
    let error = err.name ? err.name : "Exception"
    let message = err.message ? err.message : 'Unknown error'
    let statusCode = err.statusCode ? err.statusCode : 500
    if (error == 'ConditionalCheckFailedException') {
      error = 'Notification does not exists'
      message = `Recource with ID ${notificationsId} does not exists and cannot be updated`
      statusCode = 404
    }
    return {
      statusCode: statusCode,
      body: JSON.stringify({
        error,
        message
      })
    }
  }
}

module.exports.destroyMessage = async (event) => {
  const { notificationsId } = event.pathParameters

  try {
    await dynamoDb.delete({
      ...params,
      Key: {
        notification_id: notificationsId
      },
      ConditionExpression: 'attribute_exists(notification_id)'
    })
      .promise()

    return {
      statusCode: 204
    }
  } catch (err) {
    let error = err.name ? err.name : "Exception"
    let message = err.message ? err.message : 'Unknown error'
    let statusCode = err.statusCode ? err.statusCode : 500
    if (error == 'ConditionalCheckFailedException') {
      error = 'Notification does not exists'
      message = `Recource with ID ${notificationsId} does not exists and cannot be updated`
      statusCode = 404
    }
    return {
      statusCode: statusCode,
      body: JSON.stringify({
        error,
        message
      })
    }
  }
}

module.exports.listAllMessages = async (event) => {
  try {
    const queryString = {
      limit: 5,
      ...event.queryStringParameters
    }

    const { limit, next } = queryString
    let localParams = {
      ...params,
      Limit: limit
    }

    if (next) {
      localParams.ExclusiveStartKey = {
        notification_id: next
      }
    }

    let data = await dynamoDb.scan(localParams).promise()
    let nextToken = data.LastEvaluatedKey != undefined
      ? data.LastEvaluatedKey.notification_id
      : null

    const result = {
      items: data.Items,
      next_token: nextToken
    }

    return {
      statusCode: 200,
      body: JSON.stringify(result)
    }
  } catch (err) {
    return {
      statusCode: err.statusCode ? err.statusCode : 500,
      body: JSON.stringify({
        error: err.name ? err.name : "Exception",
        message: err.message ? err.message : "Unknown error",
      })
    }
  }
}
