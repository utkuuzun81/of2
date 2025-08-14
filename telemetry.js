import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

const sdk = new NodeSDK({
  serviceName: 'odyostore-backend',
  instrumentations: [getNodeAutoInstrumentations()]
});

sdk.start();
