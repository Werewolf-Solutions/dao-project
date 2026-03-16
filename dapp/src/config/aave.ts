import { AaveClient, production } from '@aave/react';

export const aaveClient = AaveClient.create({ environment: production });
