import ValidationError from '../../validationError';

import DefaultHandler, { order } from './default';
import { supportedPages, pageNameMap } from './pages';
import { convertJsonToString } from '../../utils';
import { Asset, Assets, Language } from '../../../types';

export const schema = {
  type: 'object',
};

export type Tenant = Asset & { enabled_locales: Language[]; flags: { [key: string]: boolean } };

const blockPageKeys = [
  ...Object.keys(pageNameMap),
  ...Object.values(pageNameMap),
  ...supportedPages,
];

export default class TenantHandler extends DefaultHandler {
  existing: Tenant;

  constructor(options: DefaultHandler) {
    super({
      ...options,
      type: 'tenant',
    });
  }

  async getType(): Promise<Asset> {
    const tenant = await this.client.tenant.getSettings();

    this.existing = tenant;

    blockPageKeys.forEach((key) => {
      if (tenant[key]) delete tenant[key];
    });

    return tenant;
  }

  async validate(assets: Assets): Promise<void> {
    const { tenant } = assets;

    // Nothing to validate?
    if (!tenant) return;

    const pageKeys = Object.keys(tenant).filter((k) => blockPageKeys.includes(k));
    if (pageKeys.length > 0) {
      throw new ValidationError(
        `The following pages ${convertJsonToString(
          pageKeys
        )} were found in tenant settings. Pages should be set separately. Please refer to the documentation.`
      );
    }
  }

  // Run after other updates so objected can be referenced such as default directory
  @order('100')
  async processChanges(assets: Assets): Promise<void> {
    const { tenant } = assets;

    // Do nothing if not set
    if (!tenant) return;

    const existingTenant = this.existing || this.getType();

    const sanitizedFlags = removeUnapplicableMigrationFlags(tenant.flags, existingTenant.flags);

    if (tenant && Object.keys(tenant).length > 0) {
      await this.client.tenant.updateSettings(tenant);
      this.updated += 1;
      this.didUpdate(tenant);
    }
  }
}

export const removeUnapplicableMigrationFlags = (
  existingFlags: Tenant['flags'] = {},
  proposedFlags: Tenant['flags'] = {}
): Tenant['flags'] => {
  /*
  Tenants can only update migration flags that are already configured.
  If moving configuration from one tenant to another, there may be instances
  where different migration flags exist and cause an error on update. This 
  function removes any migration flags that aren't already present on the target
  tenant. See: https://github.com/auth0/auth0-deploy-cli/issues/374
  */

  const TENANT_MIGRATION_FLAGS = [
    'disable_clickjack_protection_headers',
    'enable_mgmt_api_v1',
    'trust_azure_adfs_email_verified_connection_property',
    'include_email_in_reset_pwd_redirect',
    'include_email_in_verify_email_redirect',
  ];

  return Object.keys(proposedFlags).reduce(
    (acc: Tenant['flags'], proposedKey: string): Tenant['flags'] => {
      const isMigrationFlag = TENANT_MIGRATION_FLAGS.includes(proposedKey);
      if (!isMigrationFlag)
        return {
          ...acc,
          [proposedKey]: proposedFlags[proposedKey],
        };

      const keyCurrentlyExists = existingFlags[proposedKey] !== undefined;
      if (keyCurrentlyExists)
        return {
          ...acc,
          [proposedKey]: proposedFlags[proposedKey],
        };

      return acc;
    },
    {}
  );
};
