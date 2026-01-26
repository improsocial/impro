import "/js/components/report-dialog.js";
import { showToast } from "/js/toasts.js";

export class ReportService {
  constructor(dataLayer) {
    this.dataLayer = dataLayer;
    this.currentReportDialog = null;
  }

  async openReportDialog({ subject, subjectType }) {
    if (this.currentReportDialog !== null) {
      console.warn("Report dialog already open");
      return;
    }
    return new Promise((resolve, reject) => {
      this.currentReportDialog = document.createElement("report-dialog");
      const preferences = this.dataLayer.selectors.getPreferences();
      this.currentReportDialog.labelerDefs = preferences.labelerDefs;
      this.currentReportDialog.subjectType = subjectType;
      this.currentReportDialog.addEventListener("submit-report", async (e) => {
        const {
          reasonType,
          labelerDid,
          details,
          successCallback,
          errorCallback,
        } = e.detail;
        try {
          await this.onSubmit({
            subject,
            subjectType,
            reasonType,
            labelerDid,
            details,
          });
          successCallback();
          resolve();
        } catch (error) {
          errorCallback(error);
          reject(error);
        }
      });
      this.currentReportDialog.addEventListener("report-dialog-closed", () => {
        if (this.currentReportDialog) {
          this.currentReportDialog.remove();
          this.currentReportDialog = null;
        }
      });
      document.body.appendChild(this.currentReportDialog);
      this.currentReportDialog.open();
    });
  }

  async onSubmit({ subject, subjectType, reasonType, labelerDid, details }) {
    // Build the subject data based on the subject type
    let subjectData = null;
    switch (subjectType) {
      case "post":
        subjectData = {
          $type: "com.atproto.repo.strongRef",
          uri: subject.uri,
          cid: subject.cid,
        };
        break;
      case "account":
        subjectData = {
          $type: "com.atproto.admin.defs#repoRef",
          did: subject.did,
        };
        break;
      default:
        throw new Error(`Invalid report subject type: ${subjectType}`);
    }
    try {
      await this.dataLayer.api.createModerationReport({
        reasonType,
        reason: details,
        subject: subjectData,
        labelerDid,
      });
      showToast("Report submitted");
    } catch (error) {
      console.error(error);
      showToast("Failed to submit report", { error: true });
      throw error;
    }
  }
}
