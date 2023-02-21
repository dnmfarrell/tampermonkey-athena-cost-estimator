// ==UserScript==
// @name         AWS Athena cost estimator (USD only)
// @namespace    https://github.com/dnmfarrell/tampermonkey-athena-cost-estimator
// @version      0.6
// @description  Displays a $ cost estimate per query in the AWS Athena console
// @author       David Farrell
// @match        https://*.console.aws.amazon.com/athena/home*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=amazon.com
// @grant        none
// ==/UserScript==

(function() {
  'use strict';
  // https://aws.amazon.com/athena/pricing/ as of 2022-12-13
  const athenaPrices = {
    "us-west-1": 6.75,
    "af-south-1": 6.00,
    "ap-east-1": 5.50,
    "ap-northeast-3": 6.00,
    "ap-southeast-2": 5.75,
    "ca-central-1": 5.50,
    "eu-south-1": 5.25,
    "eu-west-3": 7.00,
    "me-south-1": 6.50,
    "sa-east-1": 9.00
  };
  const region = document.location.host.split(".",1)[0]
  const costPerTB = athenaPrices.hasOwnProperty(region) ? athenaPrices[region] : 5.00;
  console.log("Athena cost: set cost per TB to $ " + costPerTB.toFixed(2));
  observeQueryStatusChanges();
  function observeQueryStatusChanges() {
    var observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if ('classList' in node && node.classList.contains('query-status-box')) {
              console.log("Athena cost: saw new query-status-box");
              var dataScannedNode = node.querySelector("[data-testid='query-data-scanned']");
              calcEstimatedCost(dataScannedNode);
              // when the query status box is changed but not removed/added:
              var queryStatusBoxObs = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                  if (mutation.type === 'characterData') {
                    var dataScannedNode = node.querySelector("[data-testid='query-data-scanned']");
                    // only calculate when the data-scanned value changes
                    if (dataScannedNode.contains(mutation.target)) {
                      calcEstimatedCost(dataScannedNode);
                    }
                  }
                });
              });
              queryStatusBoxObs.observe(node, { childList: true, subtree: true, characterData: true});
            }
          }
        }
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
  function calcEstimatedCost(dataScannedNode) {
    try { // ignore DOM races
      if (!dataScannedNode) {
        return;
      }
      var dola = dataScannedNode.parentNode.querySelector("[data-testid='query-cost']");
      if (!dola) {
        console.log("Athena cost: creating est. cost cell");
        dola = dataScannedNode.cloneNode(true);
        dola.setAttribute("data-testid","query-cost");
        dola.firstChild.firstChild.firstChild.firstChild.data = "Est. cost";
        dataScannedNode.parentNode.appendChild(dola);
      }
      const cost = dataStrToCost(dataScannedNode.firstChild.lastChild.firstChild.textContent);
      console.log("Athena cost: scan cost " + cost);
      dola.firstChild.lastChild.innerHTML = "$ " + cost;
    } catch (e) {
      console.log("Athena cost: caught exception " + e);
    }
  }
  function dataStrToCost(data) {
    var cells = data.split(" ");
    if (!cells || cells.length < 2) {
        return (0.00).toFixed(5);
    }
    var minm = costPerTB / 100000; // 10MB minimum
    var base;
    switch (cells[1]) {
      case 'B':
        base = 10**9 * 1024; // Athena 1024 Bytes in KB, 1000 KB in MB
        break;
      case 'KB':
        base = 10**9;
        break;
      case 'MB':
        base = 10**6;
        break;
      case 'GB':
        base = 10**3;
        break;
      case 'TB':
        base = 1;
        break;
      default:
        console.log("Athena cost: error unrecognized unit " + cells[1]);
        return (0.00).toFixed(5);
    }
    var cost = parseFloat(cells[0])/base*costPerTB;
    return (cost > minm ? cost : minm).toFixed(5);
  }
})();
