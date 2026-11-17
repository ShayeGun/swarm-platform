// inside container => mongosh --username root --password --authenticationDatabase admin /docker-entrypoint-initdb.d/authn-seed.js
const dbName = "platform-prod";
const roleName = "authn_srv_role";
const userName = "authn_usr";
const userPwd = "authn_password"; // replace securely

const RW = ["find", "insert", "update", "createIndex"];
const RWD = ["find", "insert", "remove", "update", "createIndex"];
const R = ["find"];

const privileges = [
  { resource: { db: dbName, collection: "sessions" }, actions: RWD },
  { resource: { db: dbName, collection: "userlogins" }, actions: RWD },
  { resource: { db: dbName, collection: "tokens" }, actions: RW },
  { resource: { db: dbName, collection: "groups" }, actions: R },
  { resource: { db: dbName, collection: "workspaces" }, actions: RW },
  { resource: { db: dbName, collection: "fidocredentials" }, actions: RW },
  { resource: { db: dbName, collection: "samlconfigs" }, actions: R },
  { resource: { db: dbName, collection: "samldefaultconfigs" }, actions: R },
  { resource: { db: dbName, collection: "refreshtokens" }, actions: RW },
  { resource: { db: dbName, collection: "api-keys" }, actions: R },
  { resource: { db: dbName, collection: "oidc_clients" }, actions: R },
];

(function () {
  const targetDB = db.getSiblingDB(dbName);

  // Idempotent cleanup
  try {
    targetDB.runCommand({ dropUser: userName });
  } catch (e) {}
  try {
    targetDB.runCommand({ dropRole: roleName });
  } catch (e) {}

  // Create role
  try {
    targetDB.runCommand({
      createRole: roleName,
      privileges: privileges,
      roles: [],
    });
    print("Created role:", roleName);
  } catch (e) {
    print("Error creating role:", e);
    throw e;
  }

  // Create user
  try {
    targetDB.createUser({
      user: userName,
      pwd: userPwd,
      roles: [{ role: roleName, db: dbName }],
    });
    print("Created user:", userName);
  } catch (e) {
    print("Error creating user, attempting update:", e);
    try {
      targetDB.updateUser(userName, {
        roles: [{ role: roleName, db: dbName }],
      });
      print("Updated user roles:", userName);
    } catch (ee) {
      print("Failed to update user:", ee);
      throw ee;
    }
  }
})();
