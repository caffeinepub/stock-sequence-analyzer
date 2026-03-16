import Nat "mo:core/Nat";
import Text "mo:core/Text";
import Runtime "mo:core/Runtime";
import List "mo:core/List";
import Float "mo:core/Float";
import Int "mo:core/Int";
import Time "mo:core/Time";
import OutCall "http-outcalls/outcall";

actor {
  type StockAnalysisResult = {
    ticker : Text;
    sequence : [Nat];
    opens : [Float];
    closes : [Float];
    timestamps : [Float];
    error : ?Text;
  };

  public query func transform(input : OutCall.TransformationInput) : async OutCall.TransformationOutput {
    OutCall.transform(input);
  };

  func natToFloat(n : Nat) : Float {
    if (n == 0) return 0.0;
    var result : Float = 0.0;
    var rem = n;
    var place : Float = 1.0;
    while (rem > 0) {
      let digit : Float = switch (rem % 10) {
        case 0 0.0;
        case 1 1.0;
        case 2 2.0;
        case 3 3.0;
        case 4 4.0;
        case 5 5.0;
        case 6 6.0;
        case 7 7.0;
        case 8 8.0;
        case _ 9.0;
      };
      result += digit * place;
      rem := rem / 10;
      place *= 10.0;
    };
    result
  };

  func parseFloat(s : Text) : ?Float {
    let t = s.trim(#char ' ');
    if (t == "null" or t == "" or t == "NaN") return null;
    let parts = t.split(#char '.').toArray();
    if (parts.size() == 0) return null;
    switch (Nat.fromText(parts[0])) {
      case null return null;
      case (?intPart) {
        var result : Float = natToFloat(intPart);
        if (parts.size() >= 2) {
          let fracStr = parts[1];
          if (fracStr.size() > 0) {
            switch (Nat.fromText(fracStr)) {
              case null {};
              case (?frac) {
                var divisor : Float = 1.0;
                var i = 0;
                while (i < fracStr.size()) {
                  divisor *= 10.0;
                  i += 1;
                };
                result += natToFloat(frac) / divisor;
              };
            };
          };
        };
        ?result
      };
    };
  };

  func extractFloatArray(json : Text, key : Text) : ?[Float] {
    let searchKey = "\"" # key # "\":[";
    let afterParts = json.split(#text searchKey).toArray();
    if (afterParts.size() < 2) return null;
    let afterKey = afterParts[1];
    let arrParts = afterKey.split(#char ']').toArray();
    if (arrParts.size() == 0) return null;
    let arrContent = arrParts[0];
    let values = List.empty<Float>();
    for (part in arrContent.split(#char ',')) {
      switch (parseFloat(part)) {
        case null {};
        case (?f) values.add(f);
      };
    };
    let arr = values.toArray();
    if (arr.size() == 0) null else ?arr
  };

  func processTicker(ticker : Text, days : Nat) : async StockAnalysisResult {
    let url = "https://query1.finance.yahoo.com/v8/finance/chart/" # ticker # "?interval=1d&range=60d";
    let response = try {
      await OutCall.httpGetRequest(url, [], transform);
    } catch (e) {
      return { ticker; sequence = []; opens = []; closes = []; timestamps = []; error = ?("HTTP error: " # e.message()) };
    };
    let opens = switch (extractFloatArray(response, "open")) {
      case null { return { ticker; sequence = []; opens = []; closes = []; timestamps = []; error = ?"Could not parse open prices" } };
      case (?arr) arr;
    };
    let closes = switch (extractFloatArray(response, "close")) {
      case null { return { ticker; sequence = []; opens = []; closes = []; timestamps = []; error = ?"Could not parse close prices" } };
      case (?arr) arr;
    };
    let tsArr = switch (extractFloatArray(response, "timestamp")) {
      case null { return { ticker; sequence = []; opens = []; closes = []; timestamps = []; error = ?"Could not parse timestamps" } };
      case (?arr) arr;
    };

    // Compute today's UTC midnight boundary (in seconds)
    let nowNs : Int = Time.now();
    let nowSec : Int = nowNs / 1_000_000_000;
    let todayStartSec : Int = nowSec - (nowSec % 86400);
    let todayStartFloat : Float = natToFloat(Int.abs(todayStartSec));

    let len = Nat.min(Nat.min(opens.size(), closes.size()), tsArr.size());
    if (len == 0) {
      return { ticker; sequence = []; opens = []; closes = []; timestamps = []; error = ?"No price data found" };
    };

    // Find the last index of data that is strictly before today (exclude today)
    var endIdx : Nat = 0;
    var j = 0;
    while (j < len) {
      if (tsArr[j] < todayStartFloat) {
        endIdx := j + 1;
      };
      j += 1;
    };

    let available = endIdx;
    if (available == 0) {
      return { ticker; sequence = []; opens = []; closes = []; timestamps = []; error = ?"No historical data available (excluding today)" };
    };

    let start : Nat = if (available > days) { available - days } else { 0 };
    let seq = List.empty<Nat>();
    let slicedOpens = List.empty<Float>();
    let slicedCloses = List.empty<Float>();
    let slicedTs = List.empty<Float>();
    var i = start;
    while (i < available) {
      let bit : Nat = if (closes[i] > opens[i]) 1 else 0;
      seq.add(bit);
      slicedOpens.add(opens[i]);
      slicedCloses.add(closes[i]);
      slicedTs.add(tsArr[i]);
      i += 1;
    };
    { ticker; sequence = seq.toArray(); opens = slicedOpens.toArray(); closes = slicedCloses.toArray(); timestamps = slicedTs.toArray(); error = null }
  };

  public shared ({ caller = _ }) func analyzeStocks(tickers : [Text], days : Nat) : async [StockAnalysisResult] {
    if (tickers.isEmpty()) {
      Runtime.trap("Please provide at least one ticker symbol");
    };
    let resultsList = List.empty<StockAnalysisResult>();
    for (ticker in tickers.values()) {
      let result = await processTicker(ticker, days);
      resultsList.add(result);
    };
    resultsList.toArray();
  };
};
