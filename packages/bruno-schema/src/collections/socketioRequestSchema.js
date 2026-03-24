const Yup = require('yup');
const { uidSchema } = require('../common');

const keyValueSchema = Yup.object({
  uid: uidSchema,
  name: Yup.string().nullable(),
  value: Yup.string().nullable(),
  description: Yup.string().nullable(),
  enabled: Yup.boolean()
})
  .noUnknown(true)
  .strict();

const varsSchema = Yup.object({
  uid: uidSchema,
  name: Yup.string().nullable(),
  value: Yup.mixed().nullable(),
  description: Yup.string().nullable(),
  type: Yup.string().nullable(),
  enabled: Yup.boolean()
})
  .noUnknown(true)
  .strict();

const assertionSchema = Yup.object({
  uid: uidSchema,
  name: Yup.string().nullable(),
  value: Yup.string().nullable(),
  description: Yup.string().nullable(),
  enabled: Yup.boolean()
})
  .noUnknown(true)
  .strict();

const socketioRequestSchema = Yup.object({
  url: Yup.string().min(1, 'url must be at least 1 character').required('url is required'),
  namespace: Yup.string().nullable(),
  auth: Yup.mixed(),
  headers: Yup.array().of(keyValueSchema).required('headers are required'),
  body: Yup.object({
    mode: Yup.string().oneOf(['socketio']).required('mode is required'),
    socketio: Yup.array()
      .of(
        Yup.object({
          name: Yup.string().nullable(),
          type: Yup.string().nullable(),
          content: Yup.string().nullable()
        })
      )
      .nullable()
  })
    .strict()
    .required('body is required'),
  script: Yup.object({
    req: Yup.string().nullable(),
    res: Yup.string().nullable()
  })
    .noUnknown(true)
    .strict(),
  vars: Yup.object({
    req: Yup.array().of(varsSchema).nullable(),
    res: Yup.array().of(varsSchema).nullable()
  })
    .noUnknown(true)
    .strict()
    .nullable(),
  assertions: Yup.array().of(assertionSchema).nullable(),
  tests: Yup.string().nullable(),
  docs: Yup.string().nullable()
})
  .noUnknown(true)
  .strict();

module.exports = socketioRequestSchema;
