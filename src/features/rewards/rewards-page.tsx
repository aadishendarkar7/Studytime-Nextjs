'use client';
import { Badge, Card, CardHeader, Eyebrow, PageHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
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
      <PageHeader eyebrow="FOCUS WITH A GOAL" title="Rewards" description="Earn points as you study and choose a campus perk to work toward." />
      <div className="grid gap-5 lg:grid-cols-3">
        <section className="relative overflow-hidden rounded-2xl bg-[#1d4735] p-7 text-white">
          <Eyebrow className="text-[#c9deb6]">YOUR POINTS BALANCE</Eyebrow>
          <div className="mt-4 flex items-baseline gap-2"><strong className="font-display text-6xl font-extrabold">{points}</strong><span className="text-[#c9deb6]">points</span></div>
          <p className="mt-3 text-sm text-[#b7cfba]">Earn points when you complete a focus session and hit your goals.</p>
          <Icon name="star" className="absolute -right-6 -bottom-6 size-40 text-white/10" />
        </section>
        <Card>
          <CardHeader eyebrow="HOW TO EARN" title="Put in the time. See it pay off." />
          {[...Object.entries(AWARD).map(([m, p]) => [`${m} min session`, `+${p} pts`]), ['Daily goal reached', `+${DAILY_GOAL_BONUS} pts`], ['3-day / 7-day streak', `+${STREAK_BONUS.three} / +${STREAK_BONUS.weekly} pts`]].map(([l, v]) => (
            <div key={l} className="flex justify-between border-b border-line py-2.5 text-sm last:border-0"><span className="text-muted">{l}</span><strong className="text-accent-ink">{v}</strong></div>
          ))}
        </Card>
        <Card>
          <CardHeader eyebrow="YOUR REWARD GOAL" title={goal ? goal.name : 'Choose a goal'} description={goal ? `${points} of ${goal.cost} sample points${points >= goal.cost ? ' — target reached!' : ''}. Redemption needs a participating campus partner.` : 'Pick a reward below to see your progress.'} />
          <Bar value={goal ? (points / goal.cost) * 100 : 0} />
        </Card>
      </div>
      <PageHeader eyebrow="CAMPUS INCENTIVES" title="What are you studying toward?" description="These are proposed perks. Selecting one tracks progress; it does not issue real credits or gift cards." />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {REWARD_OFFERS.map((o) => (
          <Card key={o.id} className="flex flex-col">
            <Badge tone="accent" className="self-start">Proposed perk</Badge>
            <h3 className="mt-3 font-bold">{o.name}</h3>
            <p className="mt-1 flex-1 text-sm text-muted">{o.description}</p>
            <strong className="mt-3 font-display text-xl">{o.cost} <small className="text-sm text-muted">sample pts</small></strong>
            <Button className="mt-4" variant={rewardGoalId === o.id ? 'primary' : 'secondary'} onClick={() => (update({ rewardGoalId: o.id }), toast('Reward goal saved.'))}>
              {rewardGoalId === o.id ? 'Goal selected' : 'Set as goal'}
            </Button>
          </Card>
        ))}
      </div>
    </>
  );
}
