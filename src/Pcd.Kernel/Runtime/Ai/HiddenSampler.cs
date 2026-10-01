using System.Collections.Generic;

namespace Pcd.Kernel
{
    internal static class HiddenSampler
    {
        public static void Apply(MatchState state, string level, ulong seed)
        {
            string normalized = InformationLevels.Normalize(level);
            state.RngState = seed == 0 ? 1UL : seed;
            if (normalized == "omniscient")
            {
                return;
            }

            var rng = new DeterministicRng(state.RngState);
            if (normalized == "public")
            {
                var hidden = new List<CardInstance>();
                hidden.AddRange(state.Player.Hand);
                hidden.AddRange(state.Player.MatchDeck);
                hidden.Sort(Compare);
                Shuffle(hidden, rng);
                int handCount = state.Player.Hand.Count;
                state.Player.Hand.Clear();
                state.Player.MatchDeck.Clear();
                for (int i = 0; i < hidden.Count; i++)
                {
                    CardInstance card = hidden[i];
                    card.Cell = 0;
                    if (i < handCount)
                    {
                        card.Zone = Zone.Hand;
                        state.Player.Hand.Add(card);
                    }
                    else
                    {
                        card.Zone = Zone.MatchDeck;
                        state.Player.MatchDeck.Add(card);
                    }
                }

                return;
            }

            var deck = new List<CardInstance>(state.Player.MatchDeck);
            deck.Sort(Compare);
            Shuffle(deck, rng);
            state.Player.MatchDeck.Clear();
            for (int i = 0; i < deck.Count; i++)
            {
                deck[i].Zone = Zone.MatchDeck;
                deck[i].Cell = 0;
                state.Player.MatchDeck.Add(deck[i]);
            }
        }

        private static int Compare(CardInstance left, CardInstance right)
        {
            int compare = string.CompareOrdinal(left.CardId, right.CardId);
            if (compare != 0)
            {
                return compare;
            }

            compare = left.BasePoints.CompareTo(right.BasePoints);
            if (compare != 0)
            {
                return compare;
            }

            compare = left.Timer.CompareTo(right.Timer);
            if (compare != 0)
            {
                return compare;
            }

            compare = left.TimerMax.CompareTo(right.TimerMax);
            if (compare != 0)
            {
                return compare;
            }

            return left.InstanceId.CompareTo(right.InstanceId);
        }

        private static void Shuffle(List<CardInstance> cards, DeterministicRng rng)
        {
            for (int i = cards.Count - 1; i > 0; i--)
            {
                int swap = rng.NextInt(i + 1);
                CardInstance card = cards[i];
                cards[i] = cards[swap];
                cards[swap] = card;
            }
        }
    }
}
