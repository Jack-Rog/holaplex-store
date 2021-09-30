import type { NextApiRequest, NextApiResponse } from 'next';
import type { Storefront } from '@/modules/storefront/types';
import ArweaveSDK from '@/modules/arweave/client';
import { initArweave } from '@/modules/arweave';
import { ApiError } from '@/modules/utils';
import Ajv, { JTDSchemaType } from 'ajv/dist/jtd';
import { ArweaveFile } from '@/modules/arweave/types';
import { PutStorefrontParams } from '@/modules/storefront/put-storefront';
import { unpackNotarized, verifyNaclSelfContained } from '@/modules/notary';
import { PublicKey } from '@solana/web3.js';
import { WALLETS } from '@/modules/wallet/server';
import { stylesheet } from '@/modules/theme';

/** JSON schemas for parsing request parameters. */
const SCHEMAS = (() => {
  const ajv = new Ajv();

  const arweaveFile: JTDSchemaType<ArweaveFile> = {
    properties: {
      name: { type: 'string' },
      type: { type: 'string' },
      url: { type: 'string' },
    },
  };

  const storefront: JTDSchemaType<Storefront> = {
    properties: {
      theme: {
        properties: {
          primaryColor: { type: 'string' },
          backgroundColor: { type: 'string' },
          textFont: { type: 'string' },
          titleFont: { type: 'string' },
          logo: arweaveFile,
        },
        additionalProperties: true,
      },
      meta: {
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          favicon: arweaveFile,
        },
        additionalProperties: true,
      },
      subdomain: { type: 'string' },
      pubkey: { type: 'string' },
    },
    additionalProperties: true,
  };

  return { parseStorefront: ajv.compileParser(storefront) };
})();

/** Verify a notarized put request, returning the storefront to upload. */
const verifyPutParams = async (params: PutStorefrontParams) => {
  const { parseStorefront } = SCHEMAS;

  parseStorefront.message = undefined;
  const payloadDec = await unpackNotarized(
    params,
    verifyNaclSelfContained((s) => new PublicKey(s.pubkey).toBuffer()),
    { parse: parseStorefront }
  );

  if (payloadDec === undefined) {
    throw new ApiError(
      400,
      `Invalid request parameters: ${parseStorefront.message ?? 'Signature verification failed.'}`
    );
  }

  return { storefront: payloadDec };
};

/** Upload a storefront to Arweave. */
const postArweaveStorefront = async (storefront: Storefront) => {
  const {
    arweave,
    arweaveKeypair: { jwk },
  } = await WALLETS;
  const { api } = arweave.getConfig();

  // TODO: move and sign
  const tx = await arweave.createTransaction({ data: stylesheet(storefront.theme) });

  tx.addTag('Content-Type', 'text/css');
  tx.addTag('solana:pubkey', storefront.pubkey);
  tx.addTag('holaplex:metadata:subdomain', storefront.subdomain);
  tx.addTag('holaplex:metadata:favicon:url', storefront.meta.favicon.url);
  tx.addTag('holaplex:metadata:favicon:name', storefront.meta.favicon.name);
  tx.addTag('holaplex:metadata:favicon:type', storefront.meta.favicon.type);
  tx.addTag('holaplex:metadata:page:title', storefront.meta.title);
  tx.addTag('holaplex:metadata:page:description', storefront.meta.description);
  tx.addTag('holaplex:theme:logo:url', storefront.theme.logo.url);
  tx.addTag('holaplex:theme:logo:name', storefront.theme.logo.name);
  tx.addTag('holaplex:theme:logo:type', storefront.theme.logo.type);
  tx.addTag('holaplex:theme:color:primary', storefront.theme.primaryColor);
  tx.addTag('holaplex:theme:color:background', storefront.theme.backgroundColor);
  tx.addTag('holaplex:theme:font:title', storefront.theme.titleFont);
  tx.addTag('holaplex:theme:font:text', storefront.theme.textFont);
  tx.addTag('Arweave-App', 'holaplex');

  await arweave.transactions.sign(tx, jwk);
  await arweave.transactions.post(tx);
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Storefront[] | object>
) {
  try {
    switch (req.method) {
      case 'GET': {
        const arweave = initArweave();
        const storefronts = await ArweaveSDK.using(arweave).storefront.list();

        return res.status(200).json(storefronts);
      }
      case 'PUT': {
        res.setHeader('Connection', 'Keep-Alive');
        res.setHeader('Keep-Alive', `timeout=60`);

        const { storefront } = await verifyPutParams(req.body);
        await postArweaveStorefront(storefront);

        return res.status(200).json({ storefront });
      }
      default:
        res.setHeader('Allow', ['GET', 'PUT']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (e) {
    if (e instanceof ApiError) {
      return res.status(e.status).json(e.json);
    } else {
      console.error(e);

      return res.status(500).end();
    }
  }
}
