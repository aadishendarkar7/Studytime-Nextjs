'use client';
import { Badge, Card, CardHeader, PageHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bar } from '@/components/ui/progress';
import { AWARD, DAILY_GOAL_BONUS, STREAK_BONUS } from '@/features/focus/logic';
import { useProfile } from '@/lib/stores/profile';
import { toast } from '@/lib/stores/ui';
import { REWARD_OFFERS } from './catalog';

export function RewardsPage() {
  const { points, rewardGoalId, update } = useProfile();
  const goal = REWARD_OFFERS.find((o) => o.id === rewardGoalId);
  return (
    <>
      <PageHeader title="Rewards" description="Earn points as you study and choose a campus perk to work toward." />
      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader title="Points balance" />
          <div className="tnum flex items-baseline gap-2"><strong className="text-[64px] leading-[64px] font-medium">{points}</strong><span className="text-[13px] text-muted">points</span></div>
          <p className="mt-3 max-w-[68ch] text-[13px] leading-5 text-muted">Points come from finished focus sessions and from hitting your goals.</p>
        </Card>
        <Card>
          <CardHeader title="How points are earned" />
          {[...Object.entries(AWARD).map(([m, p]) => [`${m} min session`, `+${p} pts`]), ['Daily goal reached', `+${DAILY_GOAL_BONUS} pts`], ['3-day / 7-day streak', `+${STREAK_BONUS.three} / +${STREAK_BONUS.weekly} pts`]].map(([l, v]) => (
            <div key={l} className="flex justify-between border-b border-line py-2.5 text-sm last:border-0"><span className="text-muted">{l}</span><strong className="tnum font-medium text-ink">{v}</strong></div>
          ))}
        </Card>
        <Card>
          <CardHeader title={goal ? goal.name : 'Choose a goal'} description={goal ? `${points} of ${goal.cost} sample points${points >= goal.cost ? ' Target reached.' : ''}. Redemption needs a participating campus partner.` : 'Pick a reward below to see your progress.'} />
          <Bar value={goal ? (points / goal.cost) * 100 : 0} />
        </Card>
      </div>
      <div className="mt-12 mb-6 border-b border-line pb-4">
        <h2 className="text-[28px] leading-8 font-semibold">Reward goals</h2>
        <p className="mt-2 max-w-[68ch] text-muted">These are proposed perks. Selecting one tracks progress only. It does not issue real credits or gift cards.</p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {REWARD_OFFERS.map((o) => (
          <Card key={o.id} className="flex flex-col">
            <Badge tone="accent" className="self-start">Proposed perk</Badge>
            <h3 className="mt-3 font-semibold">{o.name}</h3>
            <p className="mt-1 flex-1 text-sm text-muted">{o.description}</p>
            <strong className="tnum mt-3 text-[20px] leading-6 font-medium">{o.cost} <small className="text-sm text-muted">sample pts</small></strong>
            <Button className="mt-4" variant={rewardGoalId === o.id ? 'primary' : 'secondary'} onClick={() => (update({ rewardGoalId: o.id }), toast('Reward goal saved.'))}>
              {rewardGoalId === o.id ? 'Goal selected' : 'Set as goal'}
            </Button>
          </Card>
        ))}
      </div>
    </>
  );
}
