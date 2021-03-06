// Copyright (c) 2018 by Audere
//
// Use of this source code is governed by an LGPL-3.0 license that
// can be found in the LICENSE file distributed with this file.

// --------------------------------------------------------------------------------
// database

resource "aws_db_instance" "fludb_pii" {
  allocated_storage       = 20
  availability_zone       = var.pii_availability_zone
  backup_retention_period = 35
  backup_window           = "10:00-10:59"
  ca_cert_identifier      = "rds-ca-2019"
  copy_tags_to_snapshot   = true
  deletion_protection     = true
  engine                  = "postgres"
  engine_version          = "10.6"
  identifier              = "${local.base_name}-pii"
  instance_class          = "db.t2.small"
  license_model           = "postgresql-license"
  maintenance_window      = "Sun:11:00-Sun:11:59"
  parameter_group_name    = aws_db_parameter_group.fludb_parameters.name
  password                = local.db_setup_password
  publicly_accessible     = false
  skip_final_snapshot     = false
  storage_encrypted       = true
  db_subnet_group_name    = aws_db_subnet_group.fludb.name
  username                = local.my_userid
  vpc_security_group_ids = [
    var.db_server_sg_id,
  ]

  tags = {
    Name = "${local.base_name}-pii"
  }
}

module "fludb_pii_log_archive" {
  source = "../rds-log-archive"

  bucket_name = var.log_archive_bucket_name
  db_name     = aws_db_instance.fludb_pii.identifier
}

resource "aws_db_instance" "fludb_nonpii" {
  allocated_storage       = 20
  availability_zone       = var.availability_zone
  backup_retention_period = 35
  backup_window           = "10:00-10:59"
  ca_cert_identifier      = "rds-ca-2019"
  copy_tags_to_snapshot   = true
  deletion_protection     = true
  engine                  = "postgres"
  engine_version          = "10.6"
  identifier              = "${local.base_name}-nonpii"
  instance_class          = "db.t2.small"
  license_model           = "postgresql-license"
  maintenance_window      = "Sun:11:00-Sun:11:59"
  parameter_group_name    = aws_db_parameter_group.fludb_parameters.name
  password                = local.db_setup_password
  publicly_accessible     = false
  skip_final_snapshot     = false
  storage_encrypted       = true
  db_subnet_group_name    = aws_db_subnet_group.fludb.name
  username                = local.my_userid
  vpc_security_group_ids = [
    var.db_server_sg_id,
  ]

  tags = {
    Name = "${local.base_name}-nonpii"
  }
}

module "fludb_nonpii_log_archive" {
  source = "../rds-log-archive"

  bucket_name = var.log_archive_bucket_name
  db_name     = aws_db_instance.fludb_nonpii.identifier
}

resource "aws_db_instance" "fludb_postgis" {
  allocated_storage       = 20
  availability_zone       = var.availability_zone
  backup_retention_period = 5
  backup_window           = "10:00-10:59"
  ca_cert_identifier      = "rds-ca-2019"
  copy_tags_to_snapshot   = true
  deletion_protection     = true
  engine                  = "postgres"
  engine_version          = "10.6"
  identifier              = "${local.base_name}-postgis"
  instance_class          = "db.t2.small"
  license_model           = "postgresql-license"
  maintenance_window      = "Sun:11:00-Sun:11:59"
  password                = local.db_setup_password
  publicly_accessible     = false
  skip_final_snapshot     = false
  storage_encrypted       = true
  db_subnet_group_name    = aws_db_subnet_group.fludb.name
  username                = "postgisa"
  vpc_security_group_ids = [
    var.db_server_sg_id,
  ]

  tags = {
    Name = "${local.base_name}-postgis"
  }
}

resource "aws_db_instance" "metabase" {
  allocated_storage       = 20
  availability_zone       = var.availability_zone
  backup_retention_period = 5
  backup_window           = "10:00-10:59"
  ca_cert_identifier      = "rds-ca-2019"
  copy_tags_to_snapshot   = true
  deletion_protection     = true
  engine                  = "postgres"
  engine_version          = "10.6"
  identifier              = "${local.base_name}-metabase"
  instance_class          = "db.t2.small"
  license_model           = "postgresql-license"
  maintenance_window      = "Sun:11:00-Sun:11:59"
  name                    = "metabase"
  password                = local.db_setup_password
  publicly_accessible     = false
  skip_final_snapshot     = false
  storage_encrypted       = true
  db_subnet_group_name    = aws_db_subnet_group.fludb.name
  username                = "metabasea"
  vpc_security_group_ids = [
    var.db_server_sg_id,
  ]

  tags = {
    Name = "${local.base_name}-metabase"
  }
}

resource "aws_db_parameter_group" "fludb_parameters" {
  name   = "${local.base_name}-parameters"
  family = "postgres10"

  parameter {
    name         = "pgaudit.role"
    value        = "rds_pgaudit"
    apply_method = "pending-reboot"
  }

  parameter {
    name         = "pgaudit.log"
    value        = "all"
    apply_method = "pending-reboot"
  }

  parameter {
    name         = "pgaudit.log_relation"
    value        = "on"
    apply_method = "pending-reboot"
  }

  parameter {
    name         = "shared_preload_libraries"
    value        = "pgaudit"
    apply_method = "pending-reboot"
  }
}

// --------------------------------------------------------------------------------
// provision0

resource "aws_instance" "provision0" {
  count = local.mode_provision0

  ami               = module.ami.ubuntu
  availability_zone = var.availability_zone
  instance_type     = "t2.micro"
  subnet_id         = var.transient_subnet_id
  user_data         = data.template_file.provision0_sh.rendered

  vpc_security_group_ids = [
    var.internet_egress_sg_id,
    var.db_client_sg_id,
  ]

  tags = {
    Name = "${local.base_name}-provision0"
  }
}

data "template_file" "provision0_sh" {
  template = file("${path.module}/provision0.sh")

  vars = {
    api_device_letter     = "n"
    pii_db_host           = aws_db_instance.fludb_pii.address
    nonpii_db_host        = aws_db_instance.fludb_nonpii.address
    db_setup_password     = local.db_setup_password
    environment           = var.environment
    github_tar_bz2_base64 = local.github_tar_bz2_base64
    my_device_letter      = "p"
    my_userid             = local.my_userid
    random_seed           = local.random_seed_base64
    util_sh               = file("${path.module}/../assets/util.sh")
    vpc_dhparam_base64    = local.vpc_dhparam_base64
  }
}

resource "aws_volume_attachment" "provision0_api_creds" {
  count = local.mode_provision0

  device_name = "/dev/sdn"
  instance_id = aws_instance.provision0[0].id
  volume_id   = aws_ebs_volume.api_creds.id
}

resource "aws_volume_attachment" "provision0_my_creds" {
  count = local.mode_provision0

  device_name = "/dev/sdp"
  instance_id = aws_instance.provision0[0].id
  volume_id   = element(aws_ebs_volume.admin_creds.*.id, local.my_admin_index)
}

// --------------------------------------------------------------------------------
// add admin

resource "aws_instance" "add_admin" {
  count = local.mode_add_admin

  ami               = module.ami.ubuntu
  availability_zone = var.availability_zone
  instance_type     = "t2.micro"
  subnet_id         = var.transient_subnet_id
  user_data         = data.template_file.add_admin_sh.rendered

  vpc_security_group_ids = [
    var.internet_egress_sg_id,
    var.db_client_sg_id,
  ]

  tags = {
    Name = "${local.base_name}-add-admin-${local.new_admin_userid}"
  }
}

data "template_file" "add_admin_sh" {
  template = file("${path.module}/add-admin.sh")

  vars = {
    pii_db_host       = aws_db_instance.fludb_pii.address
    nonpii_db_host    = aws_db_instance.fludb_nonpii.address
    my_device_letter  = "p"
    my_userid         = local.my_userid
    new_device_letter = "n"
    new_userid        = local.new_admin_userid
    random_seed       = local.random_seed_base64
    util_sh           = file("${path.module}/../assets/util.sh")
  }
}

resource "aws_volume_attachment" "add_admin_my_creds" {
  count = local.mode_add_admin

  device_name = "/dev/sdp"
  instance_id = aws_instance.add_admin[0].id
  volume_id   = element(aws_ebs_volume.admin_creds.*.id, local.my_admin_index)
}

resource "aws_volume_attachment" "add_admin_new_creds" {
  count = local.mode_add_admin

  device_name = "/dev/sdn"
  instance_id = aws_instance.add_admin[0].id
  volume_id   = element(aws_ebs_volume.admin_creds.*.id, local.new_admin_index)
}

// --------------------------------------------------------------------------------
// api credentials

resource "aws_ebs_volume" "api_creds" {
  availability_zone = var.availability_zone
  type              = "gp2"
  encrypted         = true
  size              = 1

  tags = {
    Name = "flu-${var.environment}-api"
  }
}

resource "aws_ebs_snapshot" "api_creds" {
  count = local.mode_after_provision0

  volume_id = aws_ebs_volume.api_creds.id

  tags = {
    Name = "flu-${var.environment}-api-creds"
  }
}

// --------------------------------------------------------------------------------
// admin credentials

resource "aws_ebs_volume" "admin_creds" {
  count = length(var.admins)

  availability_zone = var.availability_zone
  encrypted         = true
  size              = 1
  type              = "gp2"

  tags = {
    Name = "flu-${var.environment}-${element(var.admins, count.index)}-creds"
  }
}

// --------------------------------------------------------------------------------

data "aws_caller_identity" "current" {
}

module "ami" {
  source = "../ami"
}

locals {
  mode_provision0       = var.mode == "provision0" ? 1 : 0
  mode_after_provision0 = var.mode == "provision0" ? 0 : 1
  mode_provision1       = var.mode == "provision1" ? 1 : 0
  mode_add_admin        = var.mode == "add-admin" ? 1 : 0
  mode_run              = var.mode == "run" ? 1 : 0
  db_setup_password     = file(var.db_setup_password_filename)
  github_tar_bz2_base64 = file(var.github_tar_bz2_base64_filename)
  base_name             = "flu-${var.environment}-db"
  random_seed_base64    = base64encode(file(var.random_seed_filename))
  vpc_dhparam_base64    = base64encode(file(var.vpc_dhparam_filename))
  my_userid             = element(split("/", data.aws_caller_identity.current.arn), 1)
  my_admin_index        = index(var.admins, local.my_userid)
  new_admin_index       = local.mode_add_admin ? length(var.admins) - 1 : 0

  new_admin_userid = local.mode_add_admin ? element(var.admins, local.new_admin_index) : "NotCurrentlyAddingNewAdmin"
}

