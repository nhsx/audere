// Copyright (c) 2018 by Audere
//
// Use of this source code is governed by an LGPL-3.0 license that
// can be found in the LICENSE file distributed with this file.

variable "account" {
  description = "Identifier for the AWS account"
  default     = "475613123583"
}

variable "commit" {
  description = "Git commit tag (or hash) to sync"
  default     = "master"
}

variable "devs" {
  description = "Userids of developers who have SSH keys to copy to machines"
  type        = list(string)
}

variable "migrate" {
  description = "Cycle this false -> true -> false to run a db migration"
  default     = "false"
}

variable "region" {
  description = "Targeted AWS region"
  default     = "us-west-2"
}

variable "service" {
  description = "Service mode, one of 'offline', 'single', 'elb'"
  default     = "elb"
}

