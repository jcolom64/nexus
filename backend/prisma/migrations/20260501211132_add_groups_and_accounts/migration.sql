-- CreateEnum
CREATE TYPE "SystemRole" AS ENUM ('SYSTEM_ADMIN', 'ACCOUNT_VIEWER', 'LICENSE_OVERRIDE', 'USER_VIEWER');

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "systemRoles" "SystemRole"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_account_assignments" (
    "groupId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "role" "SystemRole" NOT NULL,

    CONSTRAINT "group_account_assignments_pkey" PRIMARY KEY ("groupId","accountId")
);

-- CreateTable
CREATE TABLE "_UserGroupMembers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "user_groups_name_key" ON "user_groups"("name");

-- CreateIndex
CREATE UNIQUE INDEX "_UserGroupMembers_AB_unique" ON "_UserGroupMembers"("A", "B");

-- CreateIndex
CREATE INDEX "_UserGroupMembers_B_index" ON "_UserGroupMembers"("B");

-- AddForeignKey
ALTER TABLE "group_account_assignments" ADD CONSTRAINT "group_account_assignments_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "user_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_account_assignments" ADD CONSTRAINT "group_account_assignments_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserGroupMembers" ADD CONSTRAINT "_UserGroupMembers_A_fkey" FOREIGN KEY ("A") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserGroupMembers" ADD CONSTRAINT "_UserGroupMembers_B_fkey" FOREIGN KEY ("B") REFERENCES "user_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
