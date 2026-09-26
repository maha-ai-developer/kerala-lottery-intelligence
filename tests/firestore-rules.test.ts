import { describe, it, beforeAll, afterAll, beforeEach, expect } from "vitest";
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertFails,
  assertSucceeds
} from "@firebase/rules-unit-testing";
import * as fs from "fs";
import * as path from "path";
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";

const isEmulatorActive = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

describe.runIf(!isEmulatorActive)("Firestore Security Rules (Offline Mode)", () => {
  it("informs developer that full emulator tests run via npm run test:rules", () => {
    expect(isEmulatorActive).toBe(false);
  });
});

let testEnv: RulesTestEnvironment;

describe.skipIf(!isEmulatorActive)("Firestore Security Rules Authorization Verification", () => {
  beforeAll(async () => {
    const rules = fs.readFileSync(path.resolve(__dirname, "../firestore.rules"), "utf8");
    testEnv = await initializeTestEnvironment({
      projectId: "kerala-lottery-rules-test",
      firestore: {
        rules,
        host: process.env.FIRESTORE_EMULATOR_HOST!.split(":")[0] || "127.0.0.1",
        port: parseInt(process.env.FIRESTORE_EMULATOR_HOST!.split(":")[1] || "8080", 10)
      }
    });
  });

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  beforeEach(async () => {
    if (testEnv) {
      await testEnv.clearFirestore();
    }
  });

  // --------------------------------------------------------------------------
  // 1. Unauthenticated Access
  // --------------------------------------------------------------------------
  describe("1. Unauthenticated Access", () => {
    it("denies unauthenticated read and write to users collection", async () => {
      const unauthedDb = testEnv.unauthenticatedContext().firestore();
      await assertFails(getDoc(doc(unauthedDb, "users", "any-user")));
      await assertFails(setDoc(doc(unauthedDb, "users", "any-user"), { uid: "any-user", role: "VIEWER" }));
    });

    it("denies unauthenticated read and write to research documents", async () => {
      const unauthedDb = testEnv.unauthenticatedContext().firestore();
      await assertFails(getDoc(doc(unauthedDb, "documents", "doc-01")));
      await assertFails(setDoc(doc(unauthedDb, "documents", "doc-01"), { title: "Lottery Doc" }));
    });

    it("denies unauthenticated read and write to draws & winning numbers", async () => {
      const unauthedDb = testEnv.unauthenticatedContext().firestore();
      await assertFails(getDoc(doc(unauthedDb, "draws", "draw-01")));
      await assertFails(getDoc(doc(unauthedDb, "winningNumbers", "wn-01")));
      await assertFails(setDoc(doc(unauthedDb, "winningNumbers", "wn-01"), { canonicalNumber: "0276" }));
    });

    it("denies unauthenticated write to audit logs", async () => {
      const unauthedDb = testEnv.unauthenticatedContext().firestore();
      await assertFails(setDoc(doc(unauthedDb, "auditLogs", "log-01"), { event: "TEST" }));
    });
  });

  // --------------------------------------------------------------------------
  // 2. Role: VIEWER
  // --------------------------------------------------------------------------
  describe("2. Role: VIEWER", () => {
    it("ALLOWS authenticated user to create own initial profile with role=VIEWER and status=ACTIVE", async () => {
      const viewerDb = testEnv.authenticatedContext("user-viewer-1").firestore();
      await assertSucceeds(
        setDoc(doc(viewerDb, "users", "user-viewer-1"), {
          uid: "user-viewer-1",
          role: "VIEWER",
          status: "ACTIVE",
          phoneNumber: "+919876543210",
          displayName: "Viewer One",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
      );
    });

    it("DENIES user attempting to create profile with role=ADMIN (Self-Elevation Blocked)", async () => {
      const attackerDb = testEnv.authenticatedContext("user-attacker-1").firestore();
      await assertFails(
        setDoc(doc(attackerDb, "users", "user-attacker-1"), {
          uid: "user-attacker-1",
          role: "ADMIN",
          status: "ACTIVE",
          createdAt: new Date().toISOString()
        })
      );
    });

    it("DENIES user attempting to create profile with role=RESEARCHER or ANALYST", async () => {
      const attackerDb = testEnv.authenticatedContext("user-attacker-2").firestore();
      await assertFails(
        setDoc(doc(attackerDb, "users", "user-attacker-2"), {
          uid: "user-attacker-2",
          role: "RESEARCHER",
          status: "ACTIVE"
        })
      );
      await assertFails(
        setDoc(doc(attackerDb, "users", "user-attacker-2"), {
          uid: "user-attacker-2",
          role: "ANALYST",
          status: "ACTIVE"
        })
      );
    });

    it("DENIES user attempting to create a profile under another user's UID", async () => {
      const viewerDb = testEnv.authenticatedContext("user-viewer-1").firestore();
      await assertFails(
        setDoc(doc(viewerDb, "users", "user-other-target"), {
          uid: "user-other-target",
          role: "VIEWER",
          status: "ACTIVE"
        })
      );
    });

    it("DENIES VIEWER attempting to change their own role or status", async () => {
      // Seed user profile via admin context
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), "users", "user-viewer-1"), {
          uid: "user-viewer-1",
          role: "VIEWER",
          status: "ACTIVE"
        });
      });

      const viewerDb = testEnv.authenticatedContext("user-viewer-1").firestore();
      // Changing role to ADMIN should fail
      await assertFails(
        updateDoc(doc(viewerDb, "users", "user-viewer-1"), {
          role: "ADMIN"
        })
      );
      // Changing status should fail
      await assertFails(
        updateDoc(doc(viewerDb, "users", "user-viewer-1"), {
          status: "SUSPENDED"
        })
      );
      // Updating displayName without changing role/status should succeed
      await assertSucceeds(
        updateDoc(doc(viewerDb, "users", "user-viewer-1"), {
          role: "VIEWER",
          status: "ACTIVE",
          displayName: "Updated Name"
        })
      );
    });

    it("DENIES VIEWER from writing to research data, documents, draws, and experiments", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), "users", "user-viewer-1"), {
          uid: "user-viewer-1",
          role: "VIEWER",
          status: "ACTIVE"
        });
      });

      const viewerDb = testEnv.authenticatedContext("user-viewer-1").firestore();
      await assertFails(setDoc(doc(viewerDb, "documents", "doc-01"), { title: "Illegal Write" }));
      await assertFails(setDoc(doc(viewerDb, "draws", "draw-01"), { drawNumber: "DL-69" }));
      await assertFails(setDoc(doc(viewerDb, "experiments", "exp-01"), { name: "Illegal Experiment" }));
      await assertFails(setDoc(doc(viewerDb, "knowledge_nodes", "node-01"), { label: "Illegal Node" }));
      await assertFails(setDoc(doc(viewerDb, "knowledge_edges", "edge-01"), { relation: "HAS_DRAW" }));
      await assertFails(setDoc(doc(viewerDb, "lottery_knowledge_graphs", "graph-01"), { documentSha256: "abc" }));
      await assertFails(setDoc(doc(viewerDb, "statistical_reports", "stat-01"), { totalObservedResults: 10 }));
      await assertFails(setDoc(doc(viewerDb, "lottery_corpora", "corp-01"), { totalDraws: 5 }));
      await assertFails(setDoc(doc(viewerDb, "historical_analyses", "analysis-01"), { analysisVersion: "v1" }));

      // Authenticated read is allowed
      await assertSucceeds(getDoc(doc(viewerDb, "knowledge_nodes", "node-01")));
      await assertSucceeds(getDoc(doc(viewerDb, "knowledge_edges", "edge-01")));
      await assertSucceeds(getDoc(doc(viewerDb, "lottery_knowledge_graphs", "graph-01")));
      await assertSucceeds(getDoc(doc(viewerDb, "statistical_reports", "stat-01")));
      await assertSucceeds(getDoc(doc(viewerDb, "lottery_corpora", "corp-01")));
      await assertSucceeds(getDoc(doc(viewerDb, "historical_analyses", "analysis-01")));
    });
  });

  // --------------------------------------------------------------------------
  // 3. Role: RESEARCHER
  // --------------------------------------------------------------------------
  describe("3. Role: RESEARCHER", () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), "users", "user-researcher-1"), {
          uid: "user-researcher-1",
          role: "RESEARCHER",
          status: "ACTIVE"
        });
      });
    });

    it("ALLOWS RESEARCHER to write documents, draws, winning numbers, and legal rules", async () => {
      const researcherDb = testEnv.authenticatedContext("user-researcher-1").firestore();
      await assertSucceeds(
        setDoc(doc(researcherDb, "documents", "doc-dl-69"), {
          sha256: "abcdef123456",
          source: "official-gazette"
        })
      );
      await assertSucceeds(
        setDoc(doc(researcherDb, "draws", "draw-dl-69"), {
          lotteryId: "dhanalekshmi",
          drawNumber: "DL-69"
        })
      );
      await assertSucceeds(
        setDoc(doc(researcherDb, "winningNumbers", "wn-01"), {
          canonicalNumber: "0276",
          series: "DL"
        })
      );
      await assertSucceeds(
        setDoc(doc(researcherDb, "knowledge_nodes", "node-doc-01"), {
          type: "SourceDocument",
          label: "Document 01"
        })
      );
      await assertSucceeds(
        setDoc(doc(researcherDb, "knowledge_edges", "edge-01"), {
          relation: "HAS_LOTTERY",
          sourceId: "doc-01",
          targetId: "lottery-01"
        })
      );
      await assertSucceeds(
        setDoc(doc(researcherDb, "lottery_knowledge_graphs", "graph-doc-01"), {
          documentSha256: "abcdef123456",
          nodes: []
        })
      );
      await assertSucceeds(
        setDoc(doc(researcherDb, "statistical_reports", "stat-doc-01"), {
          id: "stat-doc-01",
          totalObservedResults: 50
        })
      );
      await assertSucceeds(
        setDoc(doc(researcherDb, "lottery_corpora", "corp-doc-01"), {
          id: "corp-doc-01",
          totalDraws: 5
        })
      );
      await assertSucceeds(
        setDoc(doc(researcherDb, "historical_analyses", "analysis-doc-01"), {
          id: "analysis-doc-01",
          analysisVersion: "v1"
        })
      );
    });

    it("DENIES RESEARCHER from elevating other users to ADMIN or modifying other user roles", async () => {
      const researcherDb = testEnv.authenticatedContext("user-researcher-1").firestore();
      await assertFails(
        updateDoc(doc(researcherDb, "users", "some-target-user"), {
          role: "ADMIN"
        })
      );
    });
  });

  // --------------------------------------------------------------------------
  // 4. Role: ANALYST
  // --------------------------------------------------------------------------
  describe("4. Role: ANALYST", () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), "users", "user-analyst-1"), {
          uid: "user-analyst-1",
          role: "ANALYST",
          status: "ACTIVE"
        });
      });
    });

    it("ALLOWS ANALYST to create and update experiments, runs, and predictions", async () => {
      const analystDb = testEnv.authenticatedContext("user-analyst-1").firestore();
      await assertSucceeds(
        setDoc(doc(analystDb, "experiments", "exp-backtest-01"), {
          hypothesis: "Frequency test",
          datasetVersion: "V001"
        })
      );
      await assertSucceeds(
        setDoc(doc(analystDb, "predictions", "pred-01"), {
          modelId: "random-baseline",
          prediction: ["1234"]
        })
      );
    });

    it("DENIES ANALYST from mutating official source documents, draws, or legal rules", async () => {
      const analystDb = testEnv.authenticatedContext("user-analyst-1").firestore();
      await assertFails(
        setDoc(doc(analystDb, "documents", "doc-fraud"), {
          content: "Modified Document"
        })
      );
      await assertFails(
        setDoc(doc(analystDb, "draws", "draw-fraud"), {
          drawNumber: "Tampered"
        })
      );
    });
  });

  // --------------------------------------------------------------------------
  // 5. Role: ADMIN
  // --------------------------------------------------------------------------
  describe("5. Role: ADMIN", () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), "users", "user-admin-1"), {
          uid: "user-admin-1",
          role: "ADMIN",
          status: "ACTIVE"
        });
        await setDoc(doc(context.firestore(), "users", "target-user"), {
          uid: "target-user",
          role: "VIEWER",
          status: "ACTIVE"
        });
      });
    });

    it("ALLOWS ADMIN to read all profiles, change user roles, and manage users", async () => {
      const adminDb = testEnv.authenticatedContext("user-admin-1").firestore();
      await assertSucceeds(getDoc(doc(adminDb, "users", "target-user")));
      await assertSucceeds(
        updateDoc(doc(adminDb, "users", "target-user"), {
          role: "RESEARCHER"
        })
      );
      await assertSucceeds(deleteDoc(doc(adminDb, "users", "target-user")));
    });

    it("ALLOWS ADMIN to read audit logs", async () => {
      const adminDb = testEnv.authenticatedContext("user-admin-1").firestore();
      await assertSucceeds(getDoc(doc(adminDb, "auditLogs", "log-01")));
    });
  });

  // --------------------------------------------------------------------------
  // 6. Audit Logs Invariants
  // --------------------------------------------------------------------------
  describe("6. Audit Logs Invariants", () => {
    it("ALLOWS authenticated users to append audit logs", async () => {
      const authedDb = testEnv.authenticatedContext("user-viewer-1").firestore();
      await assertSucceeds(
        setDoc(doc(authedDb, "auditLogs", "audit-entry-01"), {
          action: "SIGN_IN",
          timestamp: new Date().toISOString()
        })
      );
    });

    it("DENIES any user (including ADMIN) from updating or deleting audit logs", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), "auditLogs", "audit-entry-01"), {
          action: "INITIAL_RECORD"
        });
      });

      const adminDb = testEnv.authenticatedContext("user-admin-1").firestore();
      // Update is strictly denied
      await assertFails(
        updateDoc(doc(adminDb, "auditLogs", "audit-entry-01"), {
          action: "TAMPERED_RECORD"
        })
      );
      // Delete is strictly denied
      await assertFails(deleteDoc(doc(adminDb, "auditLogs", "audit-entry-01")));
    });
  });
});
