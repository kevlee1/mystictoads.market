import { NextApiRequest, NextApiResponse } from 'next'
import pMap from 'p-map'
import { chunk, flatten, orderBy } from 'lodash'
import { utils as etherUtils, BigNumber } from 'ethers'
import type { OpenseaResponse, Asset } from '../../../utils/openseaTypes'
import RobeIDs from '../../../data/robes-ids.json'

const chunked = chunk(RobeIDs, 20)
//const apiKey = process.env.OPENSEA_API_KEY

const fetchRobePage = async (ids: string[]) => {
  let url = 'https://api.opensea.io/api/v1/assets?collection=cryptoadz-by-gremplin&'
  url += ids.map((id) => `token_ids=${id}`).join('&')

  // need to add api key when approved
  const res = await fetch(url)
  
  const json: OpenseaResponse = await res.json()
  
  if (json.assets) {
    return Promise.all(
      json.assets.map(async (asset) => {
        return {
          ...asset,
          image_url: asset.image_url,
        }
      }),
     )
  } else {
    return []
  }
}

export interface RobeInfo {
  id: string
  price: Number
  url: string
  svg: string
}

export const fetchRobes = async () => {
  const data = await pMap(chunked, fetchRobePage, { concurrency: 2 })
  const mapped = flatten(data)
    .filter(
      (a: Asset) =>
        a?.sell_orders?.[0]?.payment_token_contract.symbol === 'ETH',
    )
    .map((a: Asset): RobeInfo => {
      return {
        id: a.token_id,
        price: Number(
          etherUtils.formatUnits(
            BigNumber.from(a.sell_orders[0]?.current_price.split('.')[0]),
          ),
        ),
        url: a.permalink + '?ref=0x31C1b03EC94EC958DD6E53351f1760f8FF72946B',
        svg: a.image_url,
      }
    })

  return {
    robes: orderBy(mapped, ['price', 'id'], ['asc', 'asc']),
    lastUpdate: new Date().toISOString(),
  }
}

const handler = async (_req: NextApiRequest, res: NextApiResponse) => {
  try {
    const data = await fetchRobes()
    res.status(200).json(data)
  } catch (err) {
    res.status(500).json({ statusCode: 500, message: err.message })
  }
}

export default handler
