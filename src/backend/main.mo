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
        case 0 0.0; case 1 1.0; case 2 2.0; case 3 3.0; case 4 4.0;
        case 5 5.0; case 6 6.0; case 7 7.0; case 8 8.0; case _ 9.0;
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
    let (isNeg, digits) = if (t.startsWith(#text "-")) {
      (true, t.trimStart(#text "-"))
    } else {
      (false, t)
    };
    let parts = digits.split(#char '.').toArray();
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
                while (i < fracStr.size()) { divisor *= 10.0; i += 1; };
                result += natToFloat(frac) / divisor;
              };
            };
          };
        };
        if (isNeg) ?(0.0 - result) else ?result
      };
    };
  };

  // Parse array PRESERVING null positions so indices stay aligned across arrays
  func extractRawArray(json : Text, key : Text) : ?[?Float] {
    let searchKey = "\"" # key # "\":[";
    let afterParts = json.split(#text searchKey).toArray();
    if (afterParts.size() < 2) return null;
    let afterKey = afterParts[1];
    let arrParts = afterKey.split(#char ']').toArray();
    if (arrParts.size() == 0) return null;
    let arrContent = arrParts[0];
    let values = List.empty<?Float>();
    for (part in arrContent.split(#char ',')) {
      let t = part.trim(#char ' ');
      if (t == "null" or t == "" or t == "NaN") {
        values.add(null);
      } else {
        values.add(parseFloat(t));
      };
    };
    let arr = values.toArray();
    if (arr.size() == 0) null else ?arr
  };

  func fetchYahoo(ticker : Text, period1 : Int, period2 : Int) : async Text {
    let headers : [OutCall.Header] = [
      { name = "Accept"; value = "application/json, */*" },
      { name = "Accept-Language"; value = "en-US,en;q=0.9" },
      { name = "Cache-Control"; value = "no-cache" },
      { name = "Origin"; value = "https://finance.yahoo.com" },
      { name = "Referer"; value = "https://finance.yahoo.com/" },
    ];
    // Use explicit period1/period2 so Yahoo never returns today's partial candle
    let url = "https://query2.finance.yahoo.com/v8/finance/chart/" # ticker
      # "?interval=1d&period1=" # period1.toText()
      # "&period2=" # period2.toText()
      # "&includePrePost=false";
    await OutCall.httpGetRequest(url, headers, transform);
  };

  func processTicker(ticker : Text, days : Nat, period1 : Int, period2 : Int) : async StockAnalysisResult {
    let response = try {
      await fetchYahoo(ticker, period1, period2);
    } catch (e) {
      return { ticker; sequence = []; opens = []; closes = []; timestamps = []; error = ?("HTTP error: " # e.message()) };
    };

    let trimmed = response.trim(#char ' ');
    if (not trimmed.startsWith(#text "{")) {
      return { ticker; sequence = []; opens = []; closes = []; timestamps = []; error = ?"Data provider returned an unexpected response. The ticker may be invalid or the service is temporarily unavailable." };
    };

    if (response.contains(#text "\"error\":{\"code\"") or response.contains(#text "No data found") or response.contains(#text "Not Found")) {
      return { ticker; sequence = []; opens = []; closes = []; timestamps = []; error = ?("Ticker '" # ticker # "' not found or no data available.") };
    };

    // Parse all three arrays preserving null positions for correct index alignment
    let rawTs = switch (extractRawArray(response, "timestamp")) {
      case null { return { ticker; sequence = []; opens = []; closes = []; timestamps = []; error = ?"Could not parse timestamps." } };
      case (?arr) arr;
    };
    let rawOpens = switch (extractRawArray(response, "open")) {
      case null { return { ticker; sequence = []; opens = []; closes = []; timestamps = []; error = ?"Could not parse open prices." } };
      case (?arr) arr;
    };
    let rawCloses = switch (extractRawArray(response, "close")) {
      case null { return { ticker; sequence = []; opens = []; closes = []; timestamps = []; error = ?"Could not parse close prices." } };
      case (?arr) arr;
    };

    // Zip by position: only keep rows where ALL three values are non-null
    let len = Nat.min(Nat.min(rawTs.size(), rawOpens.size()), rawCloses.size());
    if (len == 0) {
      return { ticker; sequence = []; opens = []; closes = []; timestamps = []; error = ?"No price data found" };
    };

    let tsClean = List.empty<Float>();
    let opClean = List.empty<Float>();
    let clClean = List.empty<Float>();
    var k = 0;
    while (k < len) {
      switch (rawTs[k], rawOpens[k], rawCloses[k]) {
        case (?ts, ?op, ?cl) {
          tsClean.add(ts);
          opClean.add(op);
          clClean.add(cl);
        };
        case _ {};
      };
      k += 1;
    };

    let tsArr = tsClean.toArray();
    let opens = opClean.toArray();
    let closes = clClean.toArray();
    let n = tsArr.size();

    if (n == 0) {
      return { ticker; sequence = []; opens = []; closes = []; timestamps = []; error = ?"No complete price data found" };
    };

    // Take the last `days` entries (period2 already excludes today)
    let start : Nat = if (n > days) { n - days } else { 0 };
    let seq = List.empty<Nat>();
    let slicedOpens = List.empty<Float>();
    let slicedCloses = List.empty<Float>();
    let slicedTs = List.empty<Float>();
    var i = start;
    while (i < n) {
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
    let nowNs : Int = Time.now();
    let nowSec : Int = nowNs / 1_000_000_000;
    let todayStartSec : Int = nowSec - (nowSec % 86400);
    let period2 : Int = todayStartSec - 1;        // one second before today midnight UTC
    let period1 : Int = todayStartSec - 120 * 86400; // ~4 months back

    let resultsList = List.empty<StockAnalysisResult>();
    for (ticker in tickers.values()) {
      let result = await processTicker(ticker, days, period1, period2);
      resultsList.add(result);
    };
    resultsList.toArray();
  };
};
