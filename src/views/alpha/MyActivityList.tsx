import { useAnchorWallet } from '@solana/wallet-adapter-react';
import Link from 'next/link';
import { useMemo } from 'react';
import { useActivityPageQuery } from 'src/graphql/indexerTypes';
import { ActivityCard } from '@/components/ActivityCard';
import { getActivityItems } from '@/pages/profiles/[publicKey]/activity';

export function MyActivityList() {
  const anchorWallet = useAnchorWallet();
  const myPubkey = anchorWallet?.publicKey.toBase58();

  const activityPage = useActivityPageQuery({
    variables: {
      address: myPubkey,
      limit: 25,
      offset: 0,
    },
  });

  const isLoading = activityPage.loading;

  // const { data, loading, called, refetch } = useFeedQuery({
  //   // fetchPolicy: `cache-and-network`,
  //   fetchPolicy: 'no-cache',
  //   variables: {
  //     address: myPubkey,
  //   },
  // });

  // const myFeedItems = useMemo(
  //   () =>
  //     activityPage.data?.wallet?.bids
  //       ? // @ts-ignore
  //         data?.feedEvents
  //           .map((e) => generateFeedCardAttributes(e))
  //           .filter((a) => a?.sourceUser.address === myPubkey)
  //       : [],

  //   [data?.feedEvents]
  // );

  // const myFeedActivityItems: IFeedItem[] = myFeedItems.map((i) => ({
  //   id: i?.id,
  //   timestamp: i?.createdAt,
  //   type: i?.type,
  //   sourceUser: i?.sourceUser,
  //   nft: i?.nft,
  //   solAmount: i?.solAmount,
  // }));

  const activityItems = useMemo(
    () =>
      activityPage.data?.wallet?.activities
        ? // @ts-ignore
          getActivityItems(activityPage.data.wallet.activities)
        : [],

    [activityPage.data?.wallet?.activities]
  );

  // console.log('My activity', {
  //   myFeedItems,
  //   myFeedActivityItems,
  //   activityItems,
  // });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between border-b border-gray-800 pb-4">
        <h3 className="m-0 text-base font-medium text-white">Your activity</h3>
        <Link href={`/profiles/${myPubkey}/activity`} passHref>
          <a className="text-base text-gray-300">See more</a>
        </Link>
      </div>
      <div className="space-y-4">
        {activityItems
          // .concat(myFeedActivityItems)
          .slice(0, 3)
          .map((item: any) => (
            <ActivityCard activity={item} key={item.id} />
          ))}
      </div>
    </div>
  );
}
