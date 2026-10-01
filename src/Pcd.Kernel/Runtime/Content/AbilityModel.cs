using System;

namespace Pcd.Kernel
{
    public sealed class AbilityDefinition
    {
        public string Id { get; set; } = "";
        public string Trigger { get; set; } = "enter";
        public bool WhileOnBoard { get; set; }
        public bool OwnerTurn { get; set; } = true;
        public string Side { get; set; } = "";
        public int Countdown { get; set; }
        public bool Swift { get; set; }
        public bool Exhaust { get; set; }
        public bool CoverAlly { get; set; }
        public bool Absorb { get; set; }
        public string Script { get; set; } = "";
        public CostDefinition? Cost { get; set; }
        public TargetDefinition? Target { get; set; }
        public ActionDefinition[] Actions { get; set; } = Array.Empty<ActionDefinition>();
    }

    public sealed class CostDefinition
    {
        public int Sacrifice { get; set; }
        public string Resource { get; set; } = "";
        public int Amount { get; set; }
        public bool All { get; set; }
    }

    public sealed class TargetDefinition
    {
        public string Pick { get; set; } = "one";
        public string Side { get; set; } = "any";
        public string Zone { get; set; } = "board";
        public string Status { get; set; } = "";
        public bool Adjacent { get; set; }
        public bool AllowSelf { get; set; } = true;
        public string Kind { get; set; } = "any";
    }

    public sealed class ActionDefinition
    {
        public string Kind { get; set; } = "";
        public int Amount { get; set; }
        public int Count { get; set; }
        public string Status { get; set; } = "";
        public string Card { get; set; } = "";
        public string Resource { get; set; } = "";
        public string Target { get; set; } = "";
        public string To { get; set; } = "";
        public string Of { get; set; } = "";
        public string From { get; set; } = "";
        public string Ability { get; set; } = "";
        public string Script { get; set; } = "";
        public string Side { get; set; } = "";
        public string EachStatus { get; set; } = "";
        public bool Link { get; set; }
        public ActionDefinition[] Present { get; set; } = Array.Empty<ActionDefinition>();
        public ActionDefinition[] Absent { get; set; } = Array.Empty<ActionDefinition>();
    }

    public sealed class StatusDefinition
    {
        public StatusDefinition(string id, string name, bool stack, bool suppresses)
        {
            Id = id;
            Name = name;
            Stack = stack;
            Suppresses = suppresses;
        }

        public string Id { get; }
        public string Name { get; }
        public bool Stack { get; }
        public bool Suppresses { get; }
    }

    public sealed class ResourceDefinition
    {
        public ResourceDefinition(string id, string name)
        {
            Id = id;
            Name = name;
        }

        public string Id { get; }
        public string Name { get; }
    }

    public sealed class KeywordDefinition
    {
        public KeywordDefinition(string id, string name)
        {
            Id = id;
            Name = name;
        }

        public string Id { get; }
        public string Name { get; }
    }

    public sealed class DeckDefinition
    {
        public DeckDefinition(string id, string name, string[] cards)
        {
            Id = id;
            Name = name;
            Cards = cards;
        }

        public string Id { get; }
        public string Name { get; }
        public string[] Cards { get; }
    }

    public sealed class BackDefinition
    {
        public BackDefinition(string id, string name, int load, AbilityDefinition[] abilities, int cap, int points)
        {
            Id = id;
            Name = name;
            Load = load;
            Abilities = abilities ?? Array.Empty<AbilityDefinition>();
            Cap = cap;
            Points = points;
        }

        public string Id { get; }
        public string Name { get; }
        public int Load { get; }
        public AbilityDefinition[] Abilities { get; }
        public int Cap { get; }
        public int Points { get; }
    }

    public sealed class AbilityInjection
    {
        public string Host { get; set; } = "";
        public string AbilityId { get; set; } = "";
    }
}
