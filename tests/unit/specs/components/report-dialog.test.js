import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import "/js/components/report-dialog.js";

const t = new TestSuite("ReportDialog");

t.beforeEach(() => {
  document.body.innerHTML = "";
});

function connectElement(element) {
  const container = document.createElement("div");
  container.className = "page-visible";
  container.appendChild(element);
  document.body.appendChild(container);
}

function createReportDialog(subjectType = "post") {
  const element = document.createElement("report-dialog");
  element.subjectType = subjectType;
  element.labelerDefs = [
    {
      creator: {
        did: "did:plc:ar7c4by46qjdydhdevvrndac",
        handle: "moderation.bsky.app",
        displayName: "Bluesky Moderation",
      },
      reasonTypes: null,
      subjectTypes: null,
    },
  ];
  return element;
}

t.describe("ReportDialog - rendering", (it) => {
  it("should render dialog element", () => {
    const element = createReportDialog();
    connectElement(element);
    const dialog = element.querySelector(".report-dialog");
    assert(dialog !== null);
    assertEquals(dialog.tagName, "DIALOG");
  });

  it("should render close button", () => {
    const element = createReportDialog();
    connectElement(element);
    const closeButton = element.querySelector(".report-dialog-close");
    assert(closeButton !== null);
  });

  it("should render step indicators", () => {
    const element = createReportDialog();
    connectElement(element);
    const steps = element.querySelectorAll(".report-step");
    assertEquals(steps.length, 4);
  });

  it("should show first step as active", () => {
    const element = createReportDialog();
    connectElement(element);
    const firstStep = element.querySelector(".report-step.active");
    assert(firstStep !== null);
  });

  it("should display correct title for post reports", () => {
    const element = createReportDialog("post");
    connectElement(element);
    const title = element.querySelector(".report-step-title");
    assert(title.textContent.includes("post"));
  });

  it("should display correct title for account reports", () => {
    const element = createReportDialog("account");
    connectElement(element);
    const title = element.querySelector(".report-step-title");
    assert(title.textContent.includes("account"));
  });
});

t.describe("ReportDialog - initial state", (it) => {
  it("should start at step 0", () => {
    const element = createReportDialog();
    connectElement(element);
    assertEquals(element._stepIndex, 0);
  });

  it("should have no category selected", () => {
    const element = createReportDialog();
    connectElement(element);
    assertEquals(element._selectedCategory, null);
  });

  it("should have no reason type selected", () => {
    const element = createReportDialog();
    connectElement(element);
    assertEquals(element._selectedReasonType, null);
  });

  it("should have no labeler selected", () => {
    const element = createReportDialog();
    connectElement(element);
    assertEquals(element._selectedLabeler, null);
  });

  it("should have empty details", () => {
    const element = createReportDialog();
    connectElement(element);
    assertEquals(element._details, "");
  });

  it("should not be submitting", () => {
    const element = createReportDialog();
    connectElement(element);
    assertEquals(element._isSubmitting, false);
  });
});

t.describe("ReportDialog - category selection", (it) => {
  it("should render category options", () => {
    const element = createReportDialog();
    connectElement(element);
    const options = element.querySelectorAll(".report-option-card");
    assert(options.length > 0);
  });

  it("should advance to step 1 when category is selected", () => {
    const element = createReportDialog();
    connectElement(element);
    element.selectCategory({ key: "misleading", title: "Misleading" });
    assertEquals(element._stepIndex, 1);
  });

  it("should store selected category", () => {
    const element = createReportDialog();
    connectElement(element);
    const category = { key: "misleading", title: "Misleading" };
    element.selectCategory(category);
    assertEquals(element._selectedCategory, category);
  });

  it("should clear category and reset to step 0 when clearCategory is called", () => {
    const element = createReportDialog();
    connectElement(element);
    element.selectCategory({ key: "misleading", title: "Misleading" });
    element.clearCategory();
    assertEquals(element._selectedCategory, null);
    assertEquals(element._stepIndex, 0);
  });
});

t.describe("ReportDialog - reason type selection", (it) => {
  it("should advance to step 2 when reason type is selected", () => {
    const element = createReportDialog();
    connectElement(element);
    element.selectCategory({ key: "misleading", title: "Misleading" });
    element.selectReasonType({
      reasonType: "tools.ozone.report.defs#reasonMisleadingSpam",
      title: "Spam",
    });
    assertEquals(element._stepIndex, 2);
  });

  it("should store selected reason type", () => {
    const element = createReportDialog();
    connectElement(element);
    element.selectCategory({ key: "misleading", title: "Misleading" });
    const reasonType = {
      reasonType: "tools.ozone.report.defs#reasonMisleadingSpam",
      title: "Spam",
    };
    element.selectReasonType(reasonType);
    assertEquals(element._selectedReasonType, reasonType);
  });

  it("should clear reason type and labeler when clearReasonType is called", () => {
    const element = createReportDialog();
    connectElement(element);
    element.selectCategory({ key: "misleading", title: "Misleading" });
    element.selectReasonType({
      reasonType: "tools.ozone.report.defs#reasonMisleadingSpam",
      title: "Spam",
    });
    element.clearReasonType();
    assertEquals(element._selectedReasonType, null);
    assertEquals(element._selectedLabeler, null);
    assertEquals(element._stepIndex, 1);
  });
});

t.describe("ReportDialog - labeler selection", (it) => {
  it("should advance to step 3 when labeler is selected", () => {
    const element = createReportDialog();
    connectElement(element);
    element.selectCategory({ key: "misleading", title: "Misleading" });
    element.selectReasonType({
      reasonType: "tools.ozone.report.defs#reasonMisleadingSpam",
      title: "Spam",
    });
    element.selectLabeler(element.labelerDefs[0]);
    assertEquals(element._stepIndex, 3);
  });

  it("should store selected labeler", () => {
    const element = createReportDialog();
    connectElement(element);
    element.selectCategory({ key: "misleading", title: "Misleading" });
    element.selectReasonType({
      reasonType: "tools.ozone.report.defs#reasonMisleadingSpam",
      title: "Spam",
    });
    element.selectLabeler(element.labelerDefs[0]);
    assertEquals(element._selectedLabeler, element.labelerDefs[0]);
  });

  it("should clear labeler and go back to step 2 when clearLabeler is called", () => {
    const element = createReportDialog();
    connectElement(element);
    element.selectCategory({ key: "misleading", title: "Misleading" });
    element.selectReasonType({
      reasonType: "tools.ozone.report.defs#reasonMisleadingSpam",
      title: "Spam",
    });
    element.selectLabeler(element.labelerDefs[0]);
    element.clearLabeler();
    assertEquals(element._selectedLabeler, null);
    assertEquals(element._stepIndex, 2);
  });
});

t.describe("ReportDialog - open method", (it) => {
  it("should show the dialog when open() is called", () => {
    const element = createReportDialog();
    connectElement(element);
    element.open();
    const dialog = element.querySelector(".report-dialog");
    assert(dialog.open);
  });
});

t.describe("ReportDialog - close method", (it) => {
  it("should close the dialog when close() is called", () => {
    const element = createReportDialog();
    connectElement(element);
    element.open();
    element.close();
    const dialog = element.querySelector(".report-dialog");
    assert(!dialog.open);
  });

  it("should dispatch report-dialog-closed event when close() is called", () => {
    const element = createReportDialog();
    connectElement(element);
    element.open();

    let eventFired = false;
    element.addEventListener("report-dialog-closed", () => {
      eventFired = true;
    });

    element.close();
    assert(eventFired);
  });
});

t.describe("ReportDialog - submit", (it) => {
  it("should set _isSubmitting to true when submit() is called", () => {
    const element = createReportDialog();
    connectElement(element);
    element.selectCategory({ key: "misleading", title: "Misleading" });
    element.selectReasonType({
      reasonType: "tools.ozone.report.defs#reasonMisleadingSpam",
      title: "Spam",
    });
    element.selectLabeler(element.labelerDefs[0]);

    element.addEventListener("submit-report", () => {});
    element.submit();

    assertEquals(element._isSubmitting, true);
  });

  it("should dispatch submit-report event with report data", () => {
    const element = createReportDialog();
    connectElement(element);
    element.selectCategory({ key: "misleading", title: "Misleading" });
    element.selectReasonType({
      reasonType: "tools.ozone.report.defs#reasonMisleadingSpam",
      title: "Spam",
    });
    element.selectLabeler(element.labelerDefs[0]);
    element._details = "Test details";

    let receivedDetail = null;
    element.addEventListener("submit-report", (e) => {
      receivedDetail = e.detail;
    });

    element.submit();

    assert(receivedDetail !== null);
    assertEquals(receivedDetail.details, "Test details");
    assertEquals(receivedDetail.labelerDid, "did:plc:ar7c4by46qjdydhdevvrndac");
  });
});

t.describe("ReportDialog - reinitialization protection", (it) => {
  it("should not reinitialize when connectedCallback is called multiple times", () => {
    const element = createReportDialog();
    connectElement(element);
    element.selectCategory({ key: "misleading", title: "Misleading" });

    element.connectedCallback();

    assertEquals(element._selectedCategory.key, "misleading");
  });
});

await t.run();
