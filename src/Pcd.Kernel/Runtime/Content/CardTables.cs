using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace Pcd.Kernel
{
    public static class CardTables
    {
        public static string School(ContentCatalog catalog, string school)
        {
            if (catalog == null)
            {
                throw new ArgumentNullException(nameof(catalog));
            }

            var cards = new List<CardDefinition>();
            for (int i = 0; i < catalog.Cards.Length; i++)
            {
                if (catalog.Cards[i].School == school)
                {
                    cards.Add(catalog.Cards[i]);
                }
            }

            cards.Sort(CompareCard);
            var builder = new StringBuilder();
            builder.Append("| 卡牌名称 | 卡牌效果 | 点数 | 卡牌负荷 | 体系 | 稀有度 |\n");
            builder.Append("| :--- | :--- | :--- | :--- | :--- | :--- |\n");
            for (int i = 0; i < cards.Count; i++)
            {
                CardDefinition card = cards[i];
                string text = catalog.TextOf(card.Id);
                builder.Append("| ");
                builder.Append(card.Name);
                builder.Append(" | ");
                builder.Append(text.Length == 0 ? "无" : text);
                builder.Append(" | ");
                builder.Append(card.IsSpell ? "无" : card.Points.ToString(CultureInfo.InvariantCulture));
                builder.Append(" | ");
                builder.Append(card.Load.ToString(CultureInfo.InvariantCulture));
                builder.Append(" | ");
                builder.Append(SchoolName(school));
                builder.Append(" | ");
                builder.Append(RarityName(card.Rarity));
                builder.Append(" |\n");
            }

            return builder.ToString();
        }

        public static string Backs(ContentCatalog catalog)
        {
            if (catalog == null)
            {
                throw new ArgumentNullException(nameof(catalog));
            }

            var backs = new List<BackDefinition>();
            for (int i = 0; i < catalog.Backs.Length; i++)
            {
                backs.Add(catalog.Backs[i]);
            }

            backs.Sort(CompareBack);
            var builder = new StringBuilder();
            builder.Append("| 名称 | 效果 | 卡背负荷 | 数量上限 |\n");
            builder.Append("| :--- | :--- | :--- | :--- |\n");
            for (int i = 0; i < backs.Count; i++)
            {
                BackDefinition back = backs[i];
                string text = CardText.RenderBack(catalog, back);
                builder.Append("| ");
                builder.Append(back.Name);
                builder.Append(" | ");
                builder.Append(text.Length == 0 ? "无" : text);
                builder.Append(" | ");
                builder.Append(back.Load.ToString(CultureInfo.InvariantCulture));
                builder.Append(" | ");
                builder.Append(back.Cap <= 0 ? "无上限" : back.Cap.ToString(CultureInfo.InvariantCulture));
                builder.Append(" |\n");
            }

            return builder.ToString();
        }

        private static int CompareCard(CardDefinition left, CardDefinition right)
        {
            return string.CompareOrdinal(left.Id, right.Id);
        }

        private static int CompareBack(BackDefinition left, BackDefinition right)
        {
            return string.CompareOrdinal(left.Id, right.Id);
        }

        private static string SchoolName(string school)
        {
            if (school == "science")
            {
                return "科学";
            }

            if (school == "mystery")
            {
                return "神秘";
            }

            if (school == "religion")
            {
                return "宗教";
            }

            return "中立";
        }

        private static string RarityName(string rarity)
        {
            if (rarity == "blue")
            {
                return "蓝";
            }

            if (rarity == "gold")
            {
                return "金";
            }

            return "白";
        }
    }
}
