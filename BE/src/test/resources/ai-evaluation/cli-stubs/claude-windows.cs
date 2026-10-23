using System;
using System.IO;
using System.Text;

public class FakeCli {
    public static void Main(string[] args) {
        Console.In.ReadToEnd();
        int schemaIndex = Array.IndexOf(args, "--json-schema");
        File.WriteAllText(
            Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "schema.json"),
            args[schemaIndex + 1], new UTF8Encoding(false));
        Console.WriteLine(@"{""structured_output"":{""answer"":""answer"",""recommendedItemIds"":[],""scenarioName"":""example"",""metricType"":""Completeness"",""status"":""scored"",""score"":4,""reason"":""reason""}}");
    }
}
